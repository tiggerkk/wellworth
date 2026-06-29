import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../hooks/useProfile'
import { parseCsv } from '../lib/csv'
import { parseNetWorthCsv, type NetWorthImportResult } from '../lib/networth-import'
import { getSnapshotWithEntries, saveManualImportComplete } from '../data/asset-entry'
import type { AssetEntryInput } from '../data/asset-entry'
import { fetchRatesToHkd } from '../lib/fx'
import { bumpNetWorth } from '../lib/networth-refresh'
import { errorMessage } from '../lib/errors'
import { DEFAULT_BIRTH_YEAR, formatHkd, valueBase, type Currency } from '../lib/networth'
import { formatMonthLabel, startOfMonth, todayLocal } from '../lib/date'

const MAX_MESSAGES = 20

export function ImportNetWorthSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  const [params] = useSearchParams()

  const defaultMonth = (params.get('month') ?? todayLocal()).slice(0, 7)
  const [monthInput, setMonthInput] = useState(defaultMonth)
  const month = startOfMonth(`${monthInput}-01`)

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<NetWorthImportResult | null>(null)
  const [rates, setRates] = useState<{ CNY: number | null; USD: number | null } | null>(
    null,
  )
  const [existingCount, setExistingCount] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState<number | null>(null)

  // Fetch this month's FX + any existing entry count whenever the month changes.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // Intentional: clear the previous month's rates/count while the new ones load.
    /* eslint-disable react-hooks/set-state-in-effect */
    setRates(null)
    setExistingCount(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    void fetchRatesToHkd(month).then((r) => !cancelled && setRates(r))
    void getSnapshotWithEntries(userId, month)
      .then((s) => !cancelled && setExistingCount(s ? s.entries.length : 0))
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
      setResult(parseNetWorthCsv(parseCsv(text)))
      setFileName(file.name)
    } catch (e) {
      setResult(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  const rateOf = (c: Currency): number | null => (c === 'HKD' ? 1 : (rates?.[c] ?? null))
  const usedCurrencies = [...new Set((result?.rows ?? []).map((r) => r.currency))]
  const missingRate = usedCurrencies.some((c) => rateOf(c) == null)
  const total = (result?.rows ?? []).reduce((sum, r) => {
    const rate = rateOf(r.currency)
    return sum + (rate != null ? valueBase(r.value_native, rate) : 0)
  }, 0)

  async function runImport() {
    if (!userId || !result || result.rows.length === 0 || missingRate) return
    setImporting(true)
    setImportError(null)
    try {
      const payload: AssetEntryInput[] = result.rows.map((r, i) => {
        const rate = rateOf(r.currency) ?? 1
        return {
          asset_type: r.asset_type,
          name: r.name,
          currency: r.currency,
          details: r.details,
          value_native: r.value_native,
          fx_rate_to_base: rate,
          value_base: valueBase(r.value_native, rate),
          sort_order: i,
        }
      })
      const birthYear = profile?.birthday
        ? Number(profile.birthday.slice(0, 4))
        : DEFAULT_BIRTH_YEAR
      await saveManualImportComplete(userId, month, payload, birthYear, {
        usd: rateOf('USD') ?? 1,
        cny: rateOf('CNY') ?? 1,
      })
      bumpNetWorth()
      setDoneCount(payload.length)
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const rowCount = result?.rows.length ?? 0
  const errs = result?.errors ?? []

  return (
    <Sheet variant="full" label="Import Net Worth">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">
          Import Net Worth CSV
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {doneCount !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-medium text-text-primary">
              Imported {doneCount} entr{doneCount === 1 ? 'y' : 'ies'} for{' '}
              {formatMonthLabel(month)}.
            </p>
            <p className="text-sm text-text-secondary">
              They’re on the Monthly Entry and Dashboard now.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Upload a CSV in the{' '}
              <code className="text-text-primary">networth-seed-template.csv</code> format
              (see <code className="text-text-primary">templates/</code>). This{' '}
              <strong>replaces</strong> the chosen month’s entries.
            </p>

            <label className="text-xs text-text-secondary">
              Snapshot month
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
                  {rowCount === 0 ? (
                    'No valid rows found to import.'
                  ) : (
                    <>
                      Ready to import <strong>{rowCount}</strong> entr
                      {rowCount === 1 ? 'y' : 'ies'} — total{' '}
                      <strong>{formatHkd(total)}</strong>.
                      {existingCount != null && existingCount > 0 && (
                        <>
                          {' '}
                          Replaces the {existingCount} existing entr
                          {existingCount === 1 ? 'y' : 'ies'} for{' '}
                          {formatMonthLabel(month)}.
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* FX status */}
                {rowCount > 0 && (
                  <div className="rounded-card border border-border bg-surface px-4 py-3 text-xs text-text-secondary">
                    {rates == null ? (
                      'Fetching exchange rates…'
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {usedCurrencies
                          .filter((c) => c !== 'HKD')
                          .map((c) => (
                            <div key={c}>
                              {c} → HKD:{' '}
                              <span
                                className={
                                  rateOf(c) == null ? 'text-danger' : 'text-text-primary'
                                }
                              >
                                {rateOf(c) ?? 'couldn’t fetch'}
                              </span>
                            </div>
                          ))}
                        {missingRate && (
                          <p className="text-danger">
                            Couldn’t fetch a needed rate — check your connection and
                            re-choose the file.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
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
            disabled={importing || rowCount === 0 || missingRate}
            className="w-full"
          >
            {importing
              ? 'Importing…'
              : rowCount > 0
                ? `IMPORT ${rowCount} ENTR${rowCount === 1 ? 'Y' : 'IES'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>
    </Sheet>
  )
}
