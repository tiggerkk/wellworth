import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload } from '@tabler/icons-react'
import { ImportSheetHeader } from '../components/ImportSheetHeader'
import { Sheet } from '../components/Sheet'
import { ImportSheetFooter } from '../components/ImportSheetFooter'
import { LabelChip } from '../components/LabelChip'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { parseCsv } from '../lib/csv'
import {
  buildJournalImportPayload,
  parseJournalCsv,
  partitionNewJournalRows,
  type JournalImportPayload,
  type ParsedJournalRow,
} from '../lib/journal-import'
import { listJournalEntries, saveImportedJournalEntries } from '../data/journal'
import { bumpJournal } from '../lib/journal-refresh'
import { errorMessage } from '../lib/errors'
import { formatFullDate, type IsoDate } from '../lib/date'

const MAX_SAMPLE = 15

interface Preview {
  newRows: ParsedJournalRow[]
  payloads: JournalImportPayload[]
  duplicates: number
  errors: string[]
}

/**
 * Journal — bulk CSV import (folded into the Quotes module, gated behind the same
 * `quote_importer_enabled` toggle as Import CSV Quotes). Column spec: `day,journal_entry,tags`.
 * A day already in the user's journal is treated as a duplicate and skipped (the table's
 * `unique(user_id, day)` is the belt-and-braces guard, same relationship as Quotes' text_norm).
 */
export function ImportJournalSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  // Load the dedup set (existing entries' days) once.
  const existingFn = useCallback(async (): Promise<Set<IsoDate>> => {
    if (!userId) return new Set()
    const entries = await listJournalEntries(userId)
    return new Set(entries.map((e) => e.day))
  }, [userId])
  const { data: existingDays, loading: existingLoading } = useAsync(existingFn)

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [done, setDone] = useState<{ inserted: number; duplicates: number } | null>(null)

  async function onFile(file: File) {
    setImportError(null)
    setDone(null)
    if (!existingDays) return
    try {
      const result = parseJournalCsv(parseCsv(await file.text()))
      const { newRows, duplicates } = partitionNewJournalRows(result.rows, existingDays)
      const payloads = newRows.map(buildJournalImportPayload)
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
      const { inserted } = await saveImportedJournalEntries(userId, preview.payloads)
      bumpJournal()
      setDone({ inserted, duplicates: preview.duplicates })
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const newCount = preview?.newRows.length ?? 0

  return (
    <Sheet variant="full" label="Import Journal">
      <ImportSheetHeader title="Import Journal" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">
              Imported {done.inserted} entr{done.inserted === 1 ? 'y' : 'ies'}
              {done.duplicates > 0 && ` — ${done.duplicates} duplicate skipped`}.
            </p>
            <p className="text-body text-text-secondary">They’re in your Journal now.</p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload a CSV with{' '}
              <code className="text-text-primary">day, journal_entry, tags</code> columns
              (day as YYYY-MM-DD). Re-importing the same file skips days you already have
              an entry for.
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
              disabled={existingLoading}
              className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-body text-text-primary disabled:opacity-50"
            >
              <IconUpload size={18} />
              {existingLoading
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
                Ready to import <strong>{newCount}</strong> entr
                {newCount === 1 ? 'y' : 'ies'}.
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
                {preview.newRows.slice(0, MAX_SAMPLE).map((r, i) => (
                  <div
                    key={i}
                    className="border-b border-border px-3 py-2.5 last:border-b-0"
                  >
                    <p className="line-clamp-2 text-body text-text-primary">
                      {r.journal_entry}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                      <LabelChip label={formatFullDate(r.day)} />
                      {r.tags.map((t) => (
                        <span key={t} className="truncate">
                          #{t}
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
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
        submitLabel={(n) => `IMPORT ${n} ENTR${n === 1 ? 'Y' : 'IES'}`}
        done={done}
        onDone={() => navigate(-1)}
      />
    </Sheet>
  )
}
