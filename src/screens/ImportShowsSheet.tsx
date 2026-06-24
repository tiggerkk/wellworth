import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { PosterThumb } from '../components/PosterThumb'
import { ShowTypeBadge } from '../components/ShowTypeBadge'
import { StatusChip } from '../components/StatusChip'
import { TitleSearchSheet } from '../components/TitleSearchSheet'
import { useAuth } from '../auth/AuthProvider'
import { parseCsv } from '../lib/csv'
import {
  buildImportRow,
  parseShowsCsv,
  type ParsedShowRow,
  type ShowsImportResult,
} from '../lib/shows-import'
import { SHOW_STATUS_CHIP, SHOW_STATUS_LABELS, usesEpisodes } from '../lib/shows'
import {
  getTitleDetails,
  searchTitles,
  tmdbLanguage,
  type ShowMetadata,
  type TmdbSearchResult,
} from '../lib/tmdb-api'
import { saveImportedShows } from '../data/show'
import { bumpShows } from '../lib/shows-refresh'

const MAX_MESSAGES = 20
const POOL = 5

interface ResolvedRow {
  input: ParsedShowRow
  match: ShowMetadata | null
  status: 'ok' | 'review' | 'nomatch'
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

async function resolveRow(input: ParsedShowRow): Promise<ResolvedRow> {
  try {
    const results = await searchTitles(input.type, input.title)
    const top = results[0]
    if (!top) return { input, match: null, status: 'nomatch' }
    const match = await getTitleDetails(input.type, top.tmdbId, tmdbLanguage(input.title))
    return {
      input,
      match,
      status: norm(match.title) === norm(input.title) ? 'ok' : 'review',
    }
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
      setImportError(e instanceof Error ? e.message : 'Could not read the file.')
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
    setProgress(null)
    setResolved(out)
  }

  async function applyFix(i: number, r: TmdbSearchResult) {
    setFixIndex(null)
    try {
      const match = await getTitleDetails(r.type, r.tmdbId, tmdbLanguage(r.title))
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
      setImportError(e instanceof Error ? e.message : 'Import failed.')
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
        <h1 className="text-[17px] font-medium text-text-primary">Import Shows</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-medium text-text-primary">
              Imported {done.created + done.updated} title
              {done.created + done.updated === 1 ? '' : 's'} — {done.created} new,{' '}
              {done.updated} updated.
            </p>
            <p className="text-sm text-text-secondary">They’re in your Library now.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
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
              className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-[15px] text-text-primary"
            >
              <IconUpload size={18} />
              {fileName ? 'Choose a different file' : 'Choose CSV File'}
            </button>
            {fileName && (
              <p className="text-xs text-text-secondary">
                Selected: <span className="text-text-primary">{fileName}</span>
              </p>
            )}

            {errs.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-danger">
                  {errs.length} row{errs.length === 1 ? '' : 's'} skipped:
                </p>
                <ul className="flex flex-col gap-1 text-xs text-danger">
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
              <p className="text-sm text-text-secondary">
                Matching titles… {progress.done}/{progress.total}
              </p>
            )}

            {resolved && rowCount > 0 && (
              <>
                <div className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-text-primary">
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

                <div className="overflow-hidden rounded-card border border-border bg-surface">
                  {resolved.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
                    >
                      <PosterThumb
                        path={r.match?.poster_path ?? null}
                        size="w92"
                        className="h-14 w-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-text-primary">
                          {r.match?.title ?? r.input.title}
                          {r.match?.year ? ` (${r.match.year})` : ''}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
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
                          {r.status === 'nomatch' && (
                            <span className="text-danger">No match</span>
                          )}
                          {r.status === 'review' && (
                            <span className="text-accent">review “{r.input.title}”</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => setFixIndex(i)}
                        className="shrink-0 rounded-pill bg-input px-2.5 py-1 text-xs font-medium text-accent"
                      >
                        Change
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {importError && <p className="text-xs text-danger">{importError}</p>}
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
          onSelect={(r) => void applyFix(fixIndex, r)}
          onClose={() => setFixIndex(null)}
        />
      )}
    </Sheet>
  )
}
