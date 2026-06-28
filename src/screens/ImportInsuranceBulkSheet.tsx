import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../hooks/useProfile'
import { parseCsv } from '../lib/csv'
import { parseInsuranceBulkCsv, type InsuranceBulkResult } from '../lib/insurance-import'
import { upsertBulkPolicies } from '../data/insurance'
import { bumpNetWorth } from '../lib/networth-refresh'
import { errorMessage } from '../lib/errors'
import { CURRENCIES, type Currency } from '../lib/networth'
import { effectiveProviders } from '../lib/insurance-config'

const MAX_MESSAGES = 20
const CCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }))

/**
 * One-time BULK SEED of the insurance policy catalogue from the wide spreadsheet (saved as CSV).
 * Confirms each provider's currency (defaults CHUBB/BOC = USD, Manulife = HKD), then upserts every
 * numbered policy block + its Original schedule. Re-running replaces the seeded schedules.
 */
export function ImportInsuranceBulkSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  const providers = effectiveProviders(profile?.insurance_providers)

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [raw, setRaw] = useState<string[][] | null>(null)
  // Per-provider currency override (keyed by provider key); empty = use each provider's defaultCurrency.
  const [currencies, setCurrencies] = useState<Record<string, Currency>>({})
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState<number | null>(null)

  // Re-parse whenever the file or a currency choice changes (currency flows into each policy).
  const result: InsuranceBulkResult | null = raw
    ? parseInsuranceBulkCsv(raw, providers, currencies)
    : null

  async function onFile(file: File) {
    setImportError(null)
    setDoneCount(null)
    try {
      const text = await file.text()
      setRaw(parseCsv(text))
      setFileName(file.name)
    } catch (e) {
      setRaw(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  const policies = result?.policies ?? []
  const presentProviders = providers.filter((p) =>
    policies.some((pol) => pol.provider === p.key),
  )

  async function runImport() {
    if (!userId || policies.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const n = await upsertBulkPolicies(userId, policies)
      bumpNetWorth()
      setDoneCount(n)
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const errs = result?.errors ?? []
  const warns = result?.warnings ?? []

  return (
    <Sheet variant="full" label="Import insurance">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">
          Import Insurance CSV
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {doneCount !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-medium text-text-primary">
              Imported {doneCount} polic{doneCount === 1 ? 'y' : 'ies'}.
            </p>
            <p className="text-sm text-text-secondary">
              They’re in Insurance Policies and resolve into Monthly Entry by age.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Upload the wide insurance spreadsheet saved as CSV (see{' '}
              <code className="text-text-primary">
                templates/insurance-import-guide.md
              </code>
              ). Blocks without a policy number are skipped.
            </p>

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
                  {policies.length === 0
                    ? 'No importable policy blocks found.'
                    : `Ready to import ${policies.length} ${policies.length === 1 ? 'policy' : 'policies'}.`}
                </div>

                {presentProviders.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs uppercase tracking-[0.08em] text-text-secondary">
                      Confirm provider currency
                    </p>
                    {presentProviders.map((p) => (
                      <div
                        key={p.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-[15px] text-text-primary">{p.label}</span>
                        <div className="w-36">
                          <SegmentedTabs
                            value={currencies[p.key] ?? p.defaultCurrency}
                            options={CCY_OPTIONS}
                            onChange={(v) =>
                              setCurrencies((c) => ({ ...c, [p.key]: v as Currency }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {warns.length > 0 && (
                  <ul className="flex flex-col gap-1 text-xs text-warning">
                    {warns.slice(0, MAX_MESSAGES).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
                {errs.length > 0 && (
                  <ul className="flex flex-col gap-1 text-xs text-danger">
                    {errs.slice(0, MAX_MESSAGES).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
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
            disabled={importing || policies.length === 0}
            className="w-full"
          >
            {importing
              ? 'Importing…'
              : policies.length > 0
                ? `IMPORT ${policies.length} POLIC${policies.length === 1 ? 'Y' : 'IES'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>
    </Sheet>
  )
}
