import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconLink, IconUpload } from '@tabler/icons-react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { ImportSheetFooter } from '../components/ImportSheetFooter'
import { StatusChip } from '../components/StatusChip'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { parseCsv } from '../lib/csv'
import {
  buildImportPayload,
  buildTitleIndex,
  normalizeQuoteText,
  parseQuotesCsv,
  partitionNewRows,
  type ParsedQuoteRow,
  type QuoteImportPayload,
  type TitleIndex,
} from '../lib/quotes-import'
import { QUOTE_CATEGORY_CHIP } from '../lib/quotes'
import {
  categoryLabel,
  effectiveCategories,
  effectiveSourceTypes,
} from '../lib/quotes-config'
import { listQuotes, saveImportedQuotes } from '../data/quote'
import { listShows } from '../data/show'
import { listBooks } from '../data/book'
import { bumpQuotes } from '../lib/quotes-refresh'
import { errorMessage } from '../lib/errors'

const MAX_SAMPLE = 15

interface ImportContext {
  existingNorms: Set<string>
  index: TitleIndex
}

interface Preview {
  newRows: ParsedQuoteRow[]
  payloads: QuoteImportPayload[]
  duplicates: number
  errors: string[]
}

export function ImportQuotesSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  // Load the dedup set (existing quotes' normalised text) + the local Show/Book title index once.
  const ctxFn = useCallback(async (): Promise<ImportContext> => {
    if (!userId) return { existingNorms: new Set(), index: buildTitleIndex([], []) }
    const [quotes, shows, books] = await Promise.all([
      listQuotes(userId),
      listShows(userId),
      listBooks(userId),
    ])
    return {
      existingNorms: new Set(quotes.map((q) => normalizeQuoteText(q.text))),
      index: buildTitleIndex(shows, books),
    }
  }, [userId])
  const { data: ctx, loading: ctxLoading } = useAsync(ctxFn)

  // The owner's configurable Source Type / Category lists drive validation + label display.
  const { data: profile } = useProfile()
  const sourceTypes = useMemo(
    () => effectiveSourceTypes(profile?.quote_source_types ?? null),
    [profile],
  )
  const categories = useMemo(
    () => effectiveCategories(profile?.quote_categories ?? null),
    [profile],
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [done, setDone] = useState<{ inserted: number; duplicates: number } | null>(null)

  async function onFile(file: File) {
    setImportError(null)
    setDone(null)
    if (!ctx) return
    try {
      const result = parseQuotesCsv(parseCsv(await file.text()), sourceTypes, categories)
      const { newRows, duplicates } = partitionNewRows(result.rows, ctx.existingNorms)
      const payloads = newRows.map((r) => buildImportPayload(r, ctx.index, sourceTypes))
      setFileName(file.name)
      setPreview({ newRows, payloads, duplicates, errors: result.errors })
    } catch (e) {
      setPreview(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  async function runImport() {
    if (!userId || !preview || preview.payloads.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const { inserted } = await saveImportedQuotes(userId, preview.payloads)
      bumpQuotes()
      setDone({ inserted, duplicates: preview.duplicates })
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const newCount = preview?.newRows.length ?? 0

  return (
    <Sheet variant="full" label="Import Quotes">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">Import Quotes</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">
              Imported {done.inserted} quote{done.inserted === 1 ? '' : 's'}
              {done.duplicates > 0 && ` — ${done.duplicates} duplicate skipped`}.
            </p>
            <p className="text-body text-text-secondary">They’re in your Library now.</p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload a CSV in the{' '}
              <code className="text-text-primary">quotes-import-template.csv</code> format
              (see <code className="text-text-primary">templates/</code>). Re-importing
              the same file skips duplicates (idempotent).
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
              disabled={ctxLoading}
              className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-body text-text-primary disabled:opacity-50"
            >
              <IconUpload size={18} />
              {ctxLoading
                ? 'Loading…'
                : fileName
                  ? 'Choose a different file'
                  : 'Choose CSV File'}
            </button>
            {fileName && (
              <p className="text-caption text-text-secondary">
                Selected: <span className="text-text-primary">{fileName}</span>
              </p>
            )}

            {preview && (
              <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
                Ready to import <strong>{newCount}</strong> quote
                {newCount === 1 ? '' : 's'}.
                {(preview.duplicates > 0 || preview.errors.length > 0) && (
                  <span className="text-text-secondary">
                    {preview.duplicates > 0 &&
                      ` ${preview.duplicates} duplicate${preview.duplicates === 1 ? '' : 's'} skipped.`}
                    {preview.errors.length > 0 &&
                      ` ${preview.errors.length} row${preview.errors.length === 1 ? '' : 's'} flagged.`}
                  </span>
                )}
              </div>
            )}

            {preview && newCount > 0 && (
              <div className="shrink-0 overflow-hidden rounded-card border border-border bg-surface">
                {preview.newRows.slice(0, MAX_SAMPLE).map((r, i) => {
                  const linked =
                    !!preview.payloads[i]?.show_id || !!preview.payloads[i]?.book_id
                  return (
                    <div
                      key={i}
                      className="border-b border-border px-3 py-2.5 last:border-b-0"
                    >
                      <p className="line-clamp-2 text-body text-text-primary">{r.text}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                        <StatusChip
                          label={categoryLabel(categories, r.category)}
                          className={QUOTE_CATEGORY_CHIP}
                        />
                        {r.author && <span className="truncate">{r.author}</span>}
                        {linked && (
                          <span className="flex items-center gap-0.5 text-accent">
                            <IconLink size={12} /> linked
                          </span>
                        )}
                      </p>
                    </div>
                  )
                })}
                {newCount > MAX_SAMPLE && (
                  <p className="px-3 py-2 text-caption text-text-tertiary">
                    …and {newCount - MAX_SAMPLE} more.
                  </p>
                )}
              </div>
            )}

            {preview && preview.errors.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-medium text-danger">
                  {preview.errors.length} row
                  {preview.errors.length === 1 ? '' : 's'} flagged:
                </p>
                <ul className="flex flex-col gap-1 text-caption text-danger">
                  {preview.errors.slice(0, MAX_SAMPLE).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {preview.errors.length > MAX_SAMPLE && (
                    <li>…and {preview.errors.length - MAX_SAMPLE} more.</li>
                  )}
                </ul>
              </div>
            )}

            {importError && <p className="text-caption text-danger">{importError}</p>}
          </>
        )}
      </div>

      <ImportSheetFooter
        count={newCount}
        importing={importing}
        onSubmit={() => void runImport()}
        submitLabel={(n) => `IMPORT ${n} QUOTE${n === 1 ? '' : 'S'}`}
        done={done}
        onDone={() => navigate(-1)}
      />
    </Sheet>
  )
}
