import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { useAuth } from '../auth/AuthProvider'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { parseCsv } from '../lib/csv'
import { parseFoodCsv, type ImportParseResult } from '../lib/food-import'
import { importCustomFoods } from '../data/food'
import { bumpDiary } from '../lib/diary-refresh'
import { errorMessage } from '../lib/errors'

const MAX_MESSAGES = 20

function MessageList({ items, tone }: { items: string[]; tone: 'danger' | 'secondary' }) {
  if (items.length === 0) return null
  const shown = items.slice(0, MAX_MESSAGES)
  const cls = tone === 'danger' ? 'text-danger' : 'text-text-secondary'
  return (
    <ul className={`flex flex-col gap-1 text-xs ${cls}`}>
      {shown.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
      {items.length > shown.length && <li>…and {items.length - shown.length} more.</li>}
    </ul>
  )
}

export function ImportFoodsSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { nutrients, loading: refLoading } = useNutrientReference()
  const knownKeys = useMemo(
    () => new Set((nutrients ?? []).map((n) => n.key)),
    [nutrients],
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ImportParseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState<number | null>(null)

  async function onFile(file: File) {
    setImportError(null)
    setDoneCount(null)
    try {
      const text = await file.text()
      setResult(parseFoodCsv(parseCsv(text), knownKeys))
      setFileName(file.name)
    } catch (e) {
      setResult(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  async function runImport() {
    if (!result || !userId) return
    setImporting(true)
    setImportError(null)
    try {
      const n = await importCustomFoods(userId, result.records)
      bumpDiary()
      setDoneCount(n)
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const counts = useMemo(() => {
    const recs = result?.records ?? []
    const supplements = recs.filter((r) => r.type === 'supplement').length
    return { total: recs.length, foods: recs.length - supplements, supplements }
  }, [result])

  return (
    <Sheet variant="full" label="Import foods">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Import Foods</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {refLoading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : doneCount !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-medium text-text-primary">
              Imported {doneCount} item{doneCount === 1 ? '' : 's'}.
            </p>
            <p className="text-sm text-text-secondary">
              They’re in your Custom tab now (and Favorites, where you marked them).
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Upload a CSV in the{' '}
              <code className="text-text-primary">custom-foods-template.csv</code> format
              (see <code className="text-text-primary">templates/</code>). Blank cells are
              skipped; everything imports as a custom food.
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

            {result && (
              <div className="flex flex-col gap-3">
                <div className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-text-primary">
                  {counts.total === 0 ? (
                    'No valid rows found to import.'
                  ) : (
                    <>
                      Ready to import <strong>{counts.total}</strong> item
                      {counts.total === 1 ? '' : 's'} — {counts.foods} food
                      {counts.foods === 1 ? '' : 's'}, {counts.supplements} supplement
                      {counts.supplements === 1 ? '' : 's'}.
                    </>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-danger">
                      {result.errors.length} row
                      {result.errors.length === 1 ? '' : 's'} skipped:
                    </p>
                    <MessageList items={result.errors} tone="danger" />
                  </div>
                )}

                {result.warnings.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-text-secondary">Warnings:</p>
                    <MessageList items={result.warnings} tone="secondary" />
                  </div>
                )}
              </div>
            )}

            {importError && <p className="text-xs text-danger">{importError}</p>}
          </>
        )}
      </div>

      <div className="border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {doneCount !== null ? (
          <PrimaryButton onClick={() => navigate(-1)} className="w-full">
            DONE
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={() => void runImport()}
            disabled={importing || !result || result.records.length === 0}
            className="w-full"
          >
            {importing
              ? 'Importing…'
              : result
                ? `IMPORT ${result.records.length} ITEM${result.records.length === 1 ? '' : 'S'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>
    </Sheet>
  )
}
