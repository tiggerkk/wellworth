import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { CoverThumb } from '../components/CoverThumb'
import { StatusChip } from '../components/StatusChip'
import { StarRating } from '../components/StarRating'
import { ImportPreviewList } from '../components/ImportPreviewList'
import { BookSearchSheet } from '../components/BookSearchSheet'
import { useAuth } from '../auth/AuthProvider'
import { parseCsv } from '../lib/csv'
import {
  buildImportRow,
  parseBooksCsv,
  type BooksImportResult,
  type ParsedBookRow,
} from '../lib/books-import'
import { BOOK_STATUS_CHIP, BOOK_STATUS_LABELS } from '../constants/books'
import {
  BookSearchRateLimitError,
  BookSearchUnavailableError,
  getBookDetails,
  hasGoogleBooksApiKey,
  isConfidentMatch,
  isRetryableBookSearchError,
  rankSearchResults,
  searchBooks,
  type BookMetadata,
  type BookSearchResult,
} from '../lib/books-api'
import {
  getCachedBookMatch,
  removeCachedBookMatch,
  setCachedBookMatch,
} from '../lib/book-match-cache'
import { saveImportedBooks } from '../data/book'
import { bumpBooks } from '../lib/books-refresh'
import { errorMessage } from '../lib/errors'

const MAX_MESSAGES = 20
// Shown when the project's per-day Google Books quota is exhausted (won't recover until midnight
// Pacific). Unmatched rows still import as-is or can be fixed later via Change.
const DAILY_QUOTA_MESSAGE =
  'Google Books daily quota reached — it resets at midnight US-Pacific. Unmatched rows can still be imported as-is (or fixed later with Change).'
// Shown when one or more rows hit a *transient* Google Books failure — either a per-minute/burst
// 429, or a 5xx backend hiccup (e.g. 503) — that didn't clear within the in-row retry budget.
// Distinct from a genuine "book not found" (`nomatch`). The proactive rate limiter in `books-api.ts`
// (`acquireGoogleSlot`) prevents most 429s; it can't prevent Google's own backend being briefly
// overloaded, so 5xx retries still matter even with pacing in place.
const RATE_LIMITED_MESSAGE =
  'Some rows hit a temporary Google Books issue — a rate limit or a server hiccup — not "no match". Tap "Retry rate-limited" below, or fix them individually with Change.'
// Concurrent match workers. Actual request *pacing* is handled by the shared rate limiter in
// `books-api.ts` (`acquireGoogleSlot`), so this just bounds how many rows are in flight at once —
// it no longer needs to be small to avoid 429s. Kept lower without a key since the keyless quota is
// small enough that even paced requests benefit from less contention.
const POOL = hasGoogleBooksApiKey() ? 10 : 3
// In-row retry budget for a transient failure (429 rate limit or 5xx backend hiccup). The proactive
// limiter handles most 429s; it can't prevent Google's backend having a bad moment, so this budget
// still does real work for 5xx — it no longer needs to cover Google's full ~100s quota-reset window
// on its own, just a normal transient blip.
const RATE_RETRIES = 4
// Per-request ceiling. Without it a slow Open Library fallback (the Google→OL path on an empty/error
// result) can hang ~30s with no timeout and stall the whole batch on its last unresolved row. On
// timeout the row just becomes a `nomatch` the owner can fix via Change — same as any other miss.
const REQUEST_TIMEOUT_MS = 10000

interface ResolvedRow {
  input: ParsedBookRow
  match: BookMetadata | null
  // `manual` = the owner accepted the CSV row as-is, with no Google Books link (match cleared).
  // `ratelimited` = the Google Books lookup was throttled/blocked, not "no such book" — distinct
  // from `nomatch` so the preview can offer a retry instead of implying the title doesn't exist.
  status: 'ok' | 'review' | 'nomatch' | 'ratelimited' | 'manual'
}

// Rows needing attention sort to the top of the preview (rate-limited, then no-match, then review);
// resolved rows (ok/manual) follow. A stable sort keeps CSV order within each group. Frozen once at
// resolve time so rows don't jump around as the owner fixes them (Change/Manual map by position,
// preserving order) — `retryRateLimited` re-sorts explicitly after it updates a subset.
const STATUS_RANK: Record<ResolvedRow['status'], number> = {
  ratelimited: 0,
  nomatch: 1,
  review: 2,
  ok: 3,
  manual: 3,
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Backoff before retrying a transient failure (429 or 5xx). Honors Google's own `Retry-After`
 * header when it sent one; otherwise a capped exponential schedule (2s, 4s, 8s, 16s). A small random
 * jitter is always added — with `POOL` workers failing around the same moment (e.g. a 503 burst),
 * identical backoffs would just retry in lockstep and re-trigger the same burst. This only runs for
 * the failures that get past the proactive limiter in `books-api.ts`, so it no longer needs to cover
 * Google's full ~100s quota-reset window by itself. */
function backoffMs(attempt: number, retryAfterMs: number | null): number {
  const jitter = Math.random() * 500
  if (retryAfterMs != null) return retryAfterMs + jitter
  return Math.min(2000 * 2 ** attempt, 20000) + jitter
}

// --- FALLBACK (commented out): the original fixed short backoff (1s, 2s, 3s — ~6s total). This is
// what produced the mislabeled "No match" rows in the first place on its own (too short to outlast
// a real per-minute limit) — it's only safe now that the proactive limiter above is doing the main
// work of avoiding 429s. Swap back in (replace the `backoffMs(...)` call in `resolveRow` below)
// only if the exponential schedule makes single-row retries (the Change button) feel too slow.
// function backoffMsFixed(attempt: number): number {
//   return 1000 * (attempt + 1)
// }

/** Run a signal-aware async call with a hard timeout (aborts the underlying fetch on expiry). */
async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await run(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** ok/review status for a (cached or freshly-fetched) match against the CSV row. */
function matchStatus(match: BookMetadata, input: ParsedBookRow): 'ok' | 'review' {
  return isConfidentMatch(
    { title: match.title, authors: match.authors },
    { title: input.title, author: input.author },
  )
    ? 'ok'
    : 'review'
}

async function resolveRow(input: ParsedBookRow): Promise<ResolvedRow> {
  // Cache hit → skip the network entirely (the big quota saving when re-importing the same file
  // after a DB truncate/reset). Status is recomputed so it stays consistent with the current CSV row.
  const cached = getCachedBookMatch(input.title, input.author)
  if (cached) return { input, match: cached, status: matchStatus(cached, input) }
  for (let attempt = 0; ; attempt++) {
    try {
      // Query Google with title + author for recall, but rank against the title + author (not the
      // combined string) and pick the best — the same ranking the interactive search uses.
      const results = await withTimeout((signal) =>
        searchBooks(`${input.title} ${input.author}`, { signal }),
      )
      const top = rankSearchResults(results, {
        title: input.title,
        author: input.author,
      })[0]
      if (!top) return { input, match: null, status: 'nomatch' }
      const match = await withTimeout((signal) => getBookDetails(top, { signal }))
      setCachedBookMatch(input.title, input.author, match) // cache positive matches only
      return { input, match, status: matchStatus(match, input) }
    } catch (e) {
      // A *per-day* 429 quota won't recover by retrying (it resets at midnight Pacific) — rethrow so
      // the batch stops hammering an exhausted quota, distinct from every other transient case below.
      if (e instanceof BookSearchRateLimitError && e.daily) throw e
      const retryable = isRetryableBookSearchError(e)
      if (retryable) {
        // Transient 429 or 5xx — back off and retry. The proactive rate limiter in `books-api.ts`
        // makes 429s rare; it can't prevent a Google-side 5xx, so this still does real work for those.
        if (attempt < RATE_RETRIES) {
          await sleep(backoffMs(attempt, retryable.retryAfterMs))
          continue
        }
        // Retries exhausted, but this was specifically a rate limit or backend hiccup — not "no such
        // book". Surface that distinction so the owner can retry rather than accept a bad no-match.
        return { input, match: null, status: 'ratelimited' }
      }
      return { input, match: null, status: 'nomatch' }
    }
  }
}

export function ImportBooksSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<BooksImportResult | null>(null)
  const [resolved, setResolved] = useState<ResolvedRow[] | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [fixIndex, setFixIndex] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null)

  async function onFile(file: File) {
    setImportError(null)
    setDone(null)
    setResolved(null)
    try {
      const result = parseBooksCsv(parseCsv(await file.text()))
      setFileName(file.name)
      setParsed(result)
      if (result.rows.length > 0) void resolveAll(result.rows)
    } catch (e) {
      setParsed(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  async function resolveAll(rows: ParsedBookRow[]) {
    const out = new Array<ResolvedRow>(rows.length)
    let nextIdx = 0
    let completed = 0
    // Once the per-day quota is hit, every further request just 429s and burns more of an exhausted
    // quota — so workers stop pulling rows. The unmatched rows are filled in as `nomatch` below.
    let quotaHit = false
    setProgress({ done: 0, total: rows.length })
    async function worker() {
      for (;;) {
        if (quotaHit) return
        const i = nextIdx++
        if (i >= rows.length) return
        try {
          out[i] = await resolveRow(rows[i]!)
        } catch (e) {
          if (e instanceof BookSearchRateLimitError && e.daily) {
            quotaHit = true
            return
          }
          out[i] = { input: rows[i]!, match: null, status: 'nomatch' }
        }
        completed += 1
        setProgress({ done: completed, total: rows.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(POOL, rows.length) }, worker))
    if (quotaHit) {
      // Rows left unresolved by the early abort become `nomatch` so the preview is complete and
      // importable (with the CSV title/author and no Google Books link).
      for (let i = 0; i < rows.length; i++) {
        out[i] ??= { input: rows[i]!, match: null, status: 'nomatch' }
      }
      setImportError(DAILY_QUOTA_MESSAGE)
    }
    out.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    setProgress(null)
    setResolved(out)
  }

  /**
   * Re-resolve just the rows currently marked `ratelimited` — the whole point of surfacing that
   * status separately from `nomatch` is that these are worth retrying without re-uploading the CSV
   * or re-resolving already-`ok` rows. Same worker-pool pattern as `resolveAll`, scoped to a subset.
   */
  async function retryRateLimited() {
    if (!resolved) return
    const targetIndices = resolved
      .map((r, i) => (r.status === 'ratelimited' ? i : -1))
      .filter((i) => i >= 0)
    if (targetIndices.length === 0) return
    const rowsSnapshot = resolved
    setImportError(null)
    const results = new Array<ResolvedRow>(targetIndices.length)
    let cursor = 0
    let completed = 0
    let quotaHit = false
    setProgress({ done: 0, total: targetIndices.length })
    async function worker() {
      for (;;) {
        if (quotaHit) return
        const slot = cursor++
        if (slot >= targetIndices.length) return
        const rowIndex = targetIndices[slot]!
        const input = rowsSnapshot[rowIndex]!.input
        try {
          results[slot] = await resolveRow(input)
        } catch (e) {
          if (e instanceof BookSearchRateLimitError && e.daily) {
            quotaHit = true
            return
          }
          results[slot] = { input, match: null, status: 'nomatch' }
        }
        completed += 1
        setProgress({ done: completed, total: targetIndices.length })
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(POOL, targetIndices.length) }, worker),
    )
    setProgress(null)
    if (quotaHit) {
      // Rows this pass didn't even reach still stay `ratelimited` (not `nomatch`) — a daily-quota
      // abort mid-retry doesn't mean they were searched and failed, just that we stopped early.
      setImportError(DAILY_QUOTA_MESSAGE)
    }
    setResolved((prev) => {
      if (!prev) return prev
      const next = [...prev]
      targetIndices.forEach((rowIndex, slot) => {
        if (results[slot]) next[rowIndex] = results[slot]
      })
      next.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
      return next
    })
  }

  // Accept the CSV row as-is — clear any (wrong) match so the book imports with the owner's title/
  // author and no Google Books link. For rows where none of the search hits is the right book.
  function acceptManual(i: number) {
    // Forget any cached match so a row the owner rejected isn't re-applied on the next import.
    const input = resolved?.[i]?.input
    if (input) removeCachedBookMatch(input.title, input.author)
    setResolved(
      (prev) =>
        prev?.map((row, j) =>
          j === i ? { ...row, match: null, status: 'manual' } : row,
        ) ?? prev,
    )
  }

  async function applyFix(i: number, r: BookSearchResult) {
    setFixIndex(null)
    setImportError(null)
    const input = resolved?.[i]?.input
    try {
      const match = await getBookDetails(r)
      // Persist the correction so the same CSV resolves to the owner's pick on re-import.
      if (input) setCachedBookMatch(input.title, input.author, match)
      setResolved(
        (prev) =>
          prev?.map((row, j) => (j === i ? { ...row, match, status: 'ok' } : row)) ??
          prev,
      )
    } catch (e) {
      // Don't silently leave the wrong match — tell the owner the fix didn't take (e.g. a 429/503).
      setImportError(
        e instanceof BookSearchRateLimitError
          ? e.daily
            ? DAILY_QUOTA_MESSAGE
            : 'Rate-limited by Google Books — pause a moment, then try Change again.'
          : e instanceof BookSearchUnavailableError
            ? 'Google Books is temporarily unavailable — pause a moment, then try Change again.'
            : 'Could not load that title — please try Change again.',
      )
    }
  }

  async function runImport() {
    if (!userId || !resolved || resolved.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const payloads = resolved.map((r) => buildImportRow(r.input, r.match))
      const counts = await saveImportedBooks(userId, payloads)
      bumpBooks()
      setDone(counts)
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const errs = parsed?.errors ?? []
  const rowCount = resolved?.length ?? 0
  const noMatch = resolved?.filter((r) => r.status === 'nomatch').length ?? 0
  const review = resolved?.filter((r) => r.status === 'review').length ?? 0
  const rateLimited = resolved?.filter((r) => r.status === 'ratelimited').length ?? 0

  return (
    <Sheet variant="full" label="Import Books">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-heading font-medium text-text-primary">Import Books</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">
              Imported {done.created + done.updated} book
              {done.created + done.updated === 1 ? '' : 's'} — {done.created} new,{' '}
              {done.updated} updated.
            </p>
            <p className="text-body text-text-secondary">They’re in your Library now.</p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload a CSV in the{' '}
              <code className="text-text-primary">books-import-template.csv</code> format
              (see <code className="text-text-primary">templates/</code>). Each row is
              matched against Google Books and imported as <strong>Read</strong>;
              re-importing the same file updates in place.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = '' // allow re-picking the same file
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-body text-text-primary"
            >
              <IconUpload size={18} />
              {fileName ? 'Choose a different file' : 'Choose CSV File'}
            </button>
            {fileName && (
              <p className="text-caption text-text-secondary">
                Selected: <span className="text-text-primary">{fileName}</span>
              </p>
            )}

            {errs.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-medium text-danger">
                  {errs.length} row{errs.length === 1 ? '' : 's'} skipped:
                </p>
                <ul className="flex flex-col gap-1 text-caption text-danger">
                  {errs.slice(0, MAX_MESSAGES).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {errs.length > MAX_MESSAGES && (
                    <li>…and {errs.length - MAX_MESSAGES} more.</li>
                  )}
                </ul>
              </div>
            )}

            {progress && (
              <p className="text-body text-text-secondary">
                Matching books… {progress.done}/{progress.total}
              </p>
            )}

            {resolved && rowCount > 0 && (
              <>
                <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
                  Ready to import <strong>{rowCount}</strong> book
                  {rowCount === 1 ? '' : 's'}.
                  {(noMatch > 0 || review > 0 || rateLimited > 0) && (
                    <span className="text-text-secondary">
                      {' '}
                      {rateLimited > 0 && `${rateLimited} rate-limited`}
                      {rateLimited > 0 && (noMatch > 0 || review > 0) && ', '}
                      {noMatch > 0 && `${noMatch} no-match`}
                      {noMatch > 0 && review > 0 && ', '}
                      {review > 0 && `${review} to review`} — tap <strong>Change</strong>{' '}
                      to fix (or import as-is).
                    </span>
                  )}
                </div>

                {rateLimited > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
                    <p className="text-caption text-text-secondary">
                      {RATE_LIMITED_MESSAGE}
                    </p>
                    <button
                      onClick={() => void retryRateLimited()}
                      disabled={progress !== null}
                      className="shrink-0 rounded-pill bg-accent px-3 py-1.5 text-caption font-medium text-white disabled:opacity-40"
                    >
                      Retry rate-limited ({rateLimited})
                    </button>
                  </div>
                )}

                <ImportPreviewList
                  items={resolved.map((r) => ({
                    media: (
                      <CoverThumb
                        url={r.match?.cover_url ?? null}
                        className="h-14 w-10"
                      />
                    ),
                    title: r.match?.title ?? r.input.title,
                    year: r.match?.year ?? null,
                    subtitle: (r.match?.authors ?? [r.input.author]).join(', '),
                    meta: (
                      <>
                        <StatusChip
                          label={BOOK_STATUS_LABELS.read}
                          className={BOOK_STATUS_CHIP.read}
                        />
                        {r.input.rating ? (
                          <StarRating value={r.input.rating} size={12} />
                        ) : null}
                        {r.input.end_date && <span>{r.input.end_date}</span>}
                      </>
                    ),
                    status: r.status,
                    reviewLabel: r.input.title,
                  }))}
                  onChange={(i) => setFixIndex(i)}
                  onManual={(i) => acceptManual(i)}
                />
              </>
            )}

            {importError && <p className="text-caption text-danger">{importError}</p>}
          </>
        )}
      </div>

      <div className="border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {done !== null ? (
          <PrimaryButton onClick={() => navigate(-1)} className="w-full">
            DONE
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={() => void runImport()}
            disabled={importing || !resolved || rowCount === 0 || progress !== null}
            className="w-full"
          >
            {importing
              ? 'Importing…'
              : rowCount > 0
                ? `IMPORT ${rowCount} BOOK${rowCount === 1 ? '' : 'S'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>

      {fixIndex !== null && resolved && (
        <BookSearchSheet
          initialQuery={`${resolved[fixIndex]!.input.title} ${resolved[fixIndex]!.input.author}`}
          authorHint={resolved[fixIndex]!.input.author}
          onSelect={(r) => void applyFix(fixIndex, r)}
          onClose={() => setFixIndex(null)}
        />
      )}
    </Sheet>
  )
}
