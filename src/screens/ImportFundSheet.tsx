import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { IconUpload } from '@tabler/icons-react'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { Sheet } from '../components/Sheet'
import { ImportSheetFooter } from '../components/ImportSheetFooter'
import { useAuth } from '../auth/AuthProvider'
import { parseCsv } from '../lib/csv'
import { parseFundCsv, type FundImportResult } from '../lib/networth-fund-import'
import {
  getSnapshotWithEntries,
  replaceAssetTypeEntries,
  type AssetEntryInput,
} from '../data/asset-entry'
import { bumpNetWorth } from '../lib/networth-refresh'
import { errorMessage } from '../lib/errors'
import { formatHkd } from '../lib/networth'
import { formatMonthLabel, startOfMonth, todayLocal } from '../lib/date'

const MAX_MESSAGES = 20

/**
 * Monthly Fund importer — the JPM "My Portfolio" export saved as CSV. OVERWRITES the chosen month's
 * `fund` rows only (manual + insurance entries are preserved). Total Value is already HKD in the
 * export, so no FX is needed; the fund's Base Currency is kept in `details` for the detail modal.
 */
export function ImportFundSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const [params] = useSearchParams()

  const defaultMonth = (params.get('month') ?? todayLocal()).slice(0, 7)
  const [monthInput, setMonthInput] = useState(defaultMonth)
  const month = startOfMonth(`${monthInput}-01`)

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<FundImportResult | null>(null)
  const [existingCount, setExistingCount] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState<number | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void getSnapshotWithEntries(userId, month)
      .then(
        (s) =>
          !cancelled &&
          setExistingCount(
            s ? s.entries.filter((e) => e.asset_type === 'fund').length : 0,
          ),
      )
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId, month])

  async function onFile(file: File) {
    setImportError(null)
    setDoneCount(null)
    try {
      const text = await file.text()
      setResult(parseFundCsv(parseCsv(text)))
      setFileName(file.name)
    } catch (e) {
      setResult(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  const rows = result?.rows ?? []
  const total = rows.reduce((s, r) => s + r.value_hkd, 0)

  async function runImport() {
    if (!userId || rows.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const payload: AssetEntryInput[] = rows.map((r, i) => ({
        asset_type: 'fund',
        name: r.name,
        currency: 'HKD', // Total Value is already HKD in the export
        details: {
          units: r.units,
          avg_cost: r.avg_cost,
          nav: r.nav,
          nav_as_of: r.nav_as_of,
          total_cost: r.total_cost,
          return_rate: r.return_rate,
          pnl: r.pnl,
          asset_class: r.asset_class,
          currency: r.currency, // the fund's base currency (for the detail modal)
        },
        value_native: r.value_hkd,
        fx_rate_to_base: 1,
        value_base: r.value_hkd,
        sort_order: i,
      }))
      await replaceAssetTypeEntries(userId, month, 'fund', payload)
      bumpNetWorth()
      setDoneCount(payload.length)
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const errs = result?.errors ?? []

  return (
    <Sheet variant="full" label="Import funds">
      <ScreenHeaderTitle title="Import Funds CSV" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {doneCount !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">
              Imported {doneCount} fund{doneCount === 1 ? '' : 's'} for{' '}
              {formatMonthLabel(month)}.
            </p>
            <p className="text-body text-text-secondary">
              They’re on the Monthly Entry and Dashboard now.
            </p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload the JPM “My Portfolio” export saved as CSV (see{' '}
              <code className="text-text-primary">templates/fund-import-guide.md</code>).
              This <strong>overwrites</strong> the chosen month’s fund holdings.
            </p>

            <label className="text-caption text-text-secondary">
              Month
              <input
                type="month"
                value={monthInput}
                onChange={(e) => setMonthInput(e.target.value)}
                className="mt-1 field-control block w-full"
              />
            </label>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
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

            {result && (
              <div className="flex flex-col gap-3">
                <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
                  {rows.length === 0 ? (
                    'No valid fund rows found to import.'
                  ) : (
                    <>
                      Ready to import <strong>{rows.length}</strong> fund
                      {rows.length === 1 ? '' : 's'} — total{' '}
                      <strong>{formatHkd(total)}</strong>.
                      {existingCount != null && existingCount > 0 && (
                        <>
                          {' '}
                          Replaces the {existingCount} existing fund
                          {existingCount === 1 ? '' : 's'} for {formatMonthLabel(month)}.
                        </>
                      )}
                    </>
                  )}
                </div>

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
              </div>
            )}

            {importError && <p className="text-caption text-danger">{importError}</p>}
          </>
        )}
      </div>

      <ImportSheetFooter
        count={rows.length}
        importing={importing}
        onSubmit={() => void runImport()}
        submitLabel={(n) => `IMPORT ${n} FUND${n === 1 ? '' : 'S'}`}
        done={doneCount}
        onDone={() => navigate(-1)}
      />
    </Sheet>
  )
}
