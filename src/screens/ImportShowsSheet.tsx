import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { PosterThumb } from '../components/PosterThumb'
import { ShowTypeBadge } from '../components/ShowTypeBadge'
import { StatusChip } from '../components/StatusChip'
import { ImportPreviewList } from '../components/ImportPreviewList'
import { TitleSearchSheet } from '../components/TitleSearchSheet'
import { useAuth } from '../auth/AuthProvider'
import { parseCsv } from '../lib/csv'
import {
  buildImportRow,
  parseShowsCsv,
  type ParsedShowRow,
  type ShowsImportResult,
} from '../lib/shows-import'
import { SHOW_STATUS_CHIP, SHOW_STATUS_LABELS } from '../constants/shows'
import { usesEpisodes } from '../lib/shows'
import {
  getTitleDetails,
  isConfidentTitleMatch,
  parseTitleYear,
  rankTitleResults,
  searchTitles,
  tmdbLanguage,
  type ShowMetadata,
  type TmdbSearchResult,
} from '../lib/shows-tmdb-api'
import {
  getCachedShowMatch,
  removeCachedShowMatch,
  setCachedShowMatch,
} from '../lib/shows-match-cache'
import { saveImportedShows } from '../data/show'
import { bumpShows } from '../lib/shows-refresh'
import { errorMessage } from '../lib/errors'

const MAX_MESSAGES = 20
// Concurrent TMDB match workers. Each worker holds at most one connection at a time (search →
// details run sequentially), so POOL ≈ peak open connections. TMDB's practical limits are ~20
// connections / ~50 req/s; 10 sits at half the connection cap and keeps the rate well under 50/s.
const POOL = 10

interface ResolvedRow {
  input: ParsedShowRow
  match: ShowMetadata | null
  // `manual` = the owner accepted the CSV row as-is, with no TMDB link (match cleared).
  status: 'ok' | 'review' | 'nomatch' | 'manual'
}

// Rows needing attention sort to the top of the preview (no-match first, then review); resolved rows
// (ok/manual) follow. A stable sort keeps CSV order within each group. Frozen once at resolve time so
// rows don't jump around as the owner fixes them (Change/Manual map by position, preserving order).
const STATUS_RANK: Record<ResolvedRow['status'], number> = {
  nomatch: 0,
  review: 1,
  ok: 2,
  manual: 2,
}

/** ok/review status for a (cached or freshly-fetched) match against the parsed CSV title+year. */
function matchStatus(
  match: ShowMetadata,
  target: { title: string; year: number | null },
): 'ok' | 'review' {
  return isConfidentTitleMatch({ title: match.title, year: match.year }, target)
    ? 'ok'
    : 'review'
}

async function resolveRow(input: ParsedShowRow): Promise<ResolvedRow> {
  // A CSV title may carry a trailing "(YYYY)" to disambiguate (e.g. "Beyond (2017)"); TMDB
  // returns nothing for that literal, so search the clean title and rank/confirm with the year.
  const { title, year } = parseTitleYear(input.title)
  // Cache hit → skip TMDB entirely (instant re-imports of the same file after a DB reset). Status is
  // recomputed so it stays consistent with the current CSV row.
  const cached = getCachedShowMatch(input.type, title, year)
  if (cached)
    return { input, match: cached, status: matchStatus(cached, { title, year }) }
  try {
    const results = await searchTitles(input.type, title)
    const top = rankTitleResults(results, { title, year })[0]
    if (!top) return { input, match: null, status: 'nomatch' }
    const match = await getTitleDetails(input.type, top.tmdbId, tmdbLanguage(title))
    setCachedShowMatch(input.type, title, year, match) // cache positive matches only
    return { input, match, status: matchStatus(match, { title, year }) }
  } catch {
    return { input, match: null, status: 'nomatch' }
  }
}

export function ImportShowsSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ShowsImportResult | null>(null)
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
      const result = parseShowsCsv(parseCsv(await file.text()))
      setFileName(file.name)
      setParsed(result)
      if (result.rows.length > 0) void resolveAll(result.rows)
    } catch (e) {
      setParsed(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  async function resolveAll(rows: ParsedShowRow[]) {
    const out = new Array<ResolvedRow>(rows.length)
    let nextIdx = 0
    let completed = 0
    setProgress({ done: 0, total: rows.length })
    async function worker() {
      for (;;) {
        const i = nextIdx++
        if (i >= rows.length) return
        out[i] = await resolveRow(rows[i]!)
        completed += 1
        setProgress({ done: completed, total: rows.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(POOL, rows.length) }, worker))
    out.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    setProgress(null)
    setResolved(out)
  }

  // Accept the CSV row as-is — clear any (wrong) match so the title imports with the owner's
  // title/metadata and no TMDB link. For rows where none of the search hits is the right title.
  function acceptManual(i: number) {
    // Forget any cached match so a row the owner rejected isn't re-applied on the next import.
    const input = resolved?.[i]?.input
    if (input) {
      const { title, year } = parseTitleYear(input.title)
      removeCachedShowMatch(input.type, title, year)
    }
    setResolved(
      (prev) =>
        prev?.map((row, j) =>
          j === i ? { ...row, match: null, status: 'manual' } : row,
        ) ?? prev,
    )
  }

  async function applyFix(i: number, r: TmdbSearchResult) {
    setFixIndex(null)
    const input = resolved?.[i]?.input
    try {
      const match = await getTitleDetails(r.type, r.tmdbId, tmdbLanguage(r.title))
      // Persist the correction so the same CSV resolves to the owner's pick on re-import.
      if (input) {
        const { title, year } = parseTitleYear(input.title)
        setCachedShowMatch(input.type, title, year, match)
      }
      setResolved(
        (prev) =>
          prev?.map((row, j) => (j === i ? { ...row, match, status: 'ok' } : row)) ??
          prev,
      )
    } catch {
      /* leave the row as-is on a failed fix */
    }
  }

  async function runImport() {
    if (!userId || !resolved || resolved.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const payloads = resolved.map((r) => buildImportRow(r.input, r.match))
      const counts = await saveImportedShows(userId, payloads)
      bumpShows()
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

  return (
    <Sheet variant="full" label="Import Shows">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-heading font-medium text-text-primary">Import Shows</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">
              Imported {done.created + done.updated} title
              {done.created + done.updated === 1 ? '' : 's'} — {done.created} new,{' '}
              {done.updated} updated.
            </p>
            <p className="text-body text-text-secondary">They’re in your Library now.</p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload a CSV in the{' '}
              <code className="text-text-primary">shows-import-template.csv</code> format
              (see <code className="text-text-primary">templates/</code>). Each title is
              matched against TMDB; re-importing the same file updates in place.
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
                Matching titles… {progress.done}/{progress.total}
              </p>
            )}

            {resolved && rowCount > 0 && (
              <>
                <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
                  Ready to import <strong>{rowCount}</strong> title
                  {rowCount === 1 ? '' : 's'}.
                  {(noMatch > 0 || review > 0) && (
                    <span className="text-text-secondary">
                      {' '}
                      {noMatch > 0 && `${noMatch} no-match`}
                      {noMatch > 0 && review > 0 && ', '}
                      {review > 0 && `${review} to review`} — tap <strong>Change</strong>{' '}
                      to fix (or import as-is).
                    </span>
                  )}
                </div>

                <ImportPreviewList
                  items={resolved.map((r) => ({
                    media: (
                      <PosterThumb
                        path={r.match?.poster_path ?? null}
                        size="w92"
                        className="h-14 w-10"
                      />
                    ),
                    title: r.match?.title ?? r.input.title,
                    year: r.match?.year ?? null,
                    meta: (
                      <>
                        <ShowTypeBadge type={r.input.type} />
                        <StatusChip
                          label={SHOW_STATUS_LABELS[r.input.status]}
                          className={SHOW_STATUS_CHIP[r.input.status]}
                        />
                        {usesEpisodes(r.input.type) && r.match && (
                          <span>
                            {r.match.total_seasons ?? '?'}S ·{' '}
                            {r.match.total_episodes ?? '?'}E
                          </span>
                        )}
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
                ? `IMPORT ${rowCount} TITLE${rowCount === 1 ? '' : 'S'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>

      {fixIndex !== null && resolved && (
        <TitleSearchSheet
          type={resolved[fixIndex]!.input.type}
          initialQuery={parseTitleYear(resolved[fixIndex]!.input.title).title}
          yearHint={parseTitleYear(resolved[fixIndex]!.input.title).year}
          onSelect={(r) => void applyFix(fixIndex, r)}
          onClose={() => setFixIndex(null)}
        />
      )}
    </Sheet>
  )
}
