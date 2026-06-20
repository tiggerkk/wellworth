import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconLink, IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { StatusChip } from '../components/StatusChip'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
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
import { QUOTE_CATEGORY_LABELS, type QuoteCategory } from '../constants/quotes'
import { listQuotes, saveImportedQuotes } from '../data/quote'
import { listShows } from '../data/show'
import { listBooks } from '../data/book'
import { bumpQuotes } from '../lib/quotes-refresh'

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
      const result = parseQuotesCsv(parseCsv(await file.text()))
      const { newRows, duplicates } = partitionNewRows(result.rows, ctx.existingNorms)
      const payloads = newRows.map((r) => buildImportPayload(r, ctx.index))
      setFileName(file.name)
      setPreview({ newRows, payloads, duplicates, errors: result.errors })
    } catch (e) {
      setPreview(null)
      setImportError(e instanceof Error ? e.message : 'Could not read the file.')
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
      setImportError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const newCount = preview?.newRows.length ?? 0

  return (
    <Sheet variant="full" label="Import Quotes">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Import Quotes CSV</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-medium text-text-primary">
              Imported {done.inserted} quote{done.inserted === 1 ? '' : 's'}
              {done.duplicates > 0 && ` — ${done.duplicates} duplicate skipped`}.
            </p>
            <p className="text-sm text-text-secondary">They’re in your Library now.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
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
              className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-[15px] text-text-primary disabled:opacity-50"
            >
              <IconUpload size={18} />
              {ctxLoading
                ? 'Loading…'
                : fileName
                  ? 'Choose a different file'
                  : 'Choose CSV file'}
            </button>
            {fileName && (
              <p className="text-xs text-text-secondary">
                Selected: <span className="text-text-primary">{fileName}</span>
              </p>
            )}

            {preview && (
              <div className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-text-primary">
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
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                {preview.newRows.slice(0, MAX_SAMPLE).map((r, i) => {
                  const linked =
                    !!preview.payloads[i]?.show_id || !!preview.payloads[i]?.book_id
                  return (
                    <div
                      key={i}
                      className="border-b border-border px-3 py-2.5 last:border-b-0"
                    >
                      <p className="line-clamp-2 text-[15px] text-text-primary">
                        {r.text}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <StatusChip
                          label={QUOTE_CATEGORY_LABELS[r.category as QuoteCategory]}
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
                  <p className="px-3 py-2 text-xs text-text-tertiary">
                    …and {newCount - MAX_SAMPLE} more.
                  </p>
                )}
              </div>
            )}

            {preview && preview.errors.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-danger">
                  {preview.errors.length} row
                  {preview.errors.length === 1 ? '' : 's'} flagged:
                </p>
                <ul className="flex flex-col gap-1 text-xs text-danger">
                  {preview.errors.slice(0, MAX_SAMPLE).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {preview.errors.length > MAX_SAMPLE && (
                    <li>…and {preview.errors.length - MAX_SAMPLE} more.</li>
                  )}
                </ul>
              </div>
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
            disabled={importing || newCount === 0}
            className="w-full"
          >
            {importing
              ? 'Importing…'
              : newCount > 0
                ? `IMPORT ${newCount} QUOTE${newCount === 1 ? '' : 'S'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>
    </Sheet>
  )
}
