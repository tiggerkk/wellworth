import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../hooks/useProfile'
import { parseCsv } from '../lib/csv'
import { parseInsuranceBulkCsv, type InsuranceBulkResult } from '../lib/insurance-import'
import {
  planBulkImport,
  applyBulkImport,
  type BulkImportItem,
  type BulkImportPlan,
} from '../data/insurance'
import { bumpNetWorth } from '../lib/networth-refresh'
import { errorMessage } from '../lib/errors'
import { CURRENCIES, type Currency } from '../lib/networth'
import { effectiveProviders } from '../lib/insurance-config'
import { todayLocal } from '../lib/date'

const MAX_MESSAGES = 20
const CCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }))

type BucketKey = 'created' | 'added' | 'untouched'

interface DoneStats {
  created: number
  added: number
  untouched: number
}

/**
 * BULK import of the insurance policy catalogue from the wide spreadsheet (saved as CSV).
 * Confirms each provider's currency, previews what will change (new policies / new schedule
 * versions / already-up-to-date), then applies it on IMPORT: creates policies that don't exist
 * yet (with an Original schedule), adds a new schedule version to existing policies whose CSV
 * date is new, and leaves everything else untouched — it never deletes or replaces an existing
 * schedule. To force a re-import of a specific schedule, delete it manually first.
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
  const [doneStats, setDoneStats] = useState<DoneStats | null>(null)

  const [plan, setPlan] = useState<BulkImportPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [openBucket, setOpenBucket] = useState<Record<BucketKey, boolean>>({
    created: true,
    added: true,
    untouched: false,
  })

  // Owner's current insurance age drives maturity auto-detection (a schedule ending before it =
  // matured). Skipped (NaN) when no birthday is set.
  const birthYear = profile?.birthday ? Number(profile.birthday.slice(0, 4)) : NaN
  const currentAge = Number.isFinite(birthYear)
    ? Number(todayLocal().slice(0, 4)) - birthYear
    : NaN

  // Re-parse whenever the file or a currency choice changes (currency flows into each policy).
  const result: InsuranceBulkResult | null = raw
    ? parseInsuranceBulkCsv(raw, providers, currencies, currentAge)
    : null

  const policies = result?.policies ?? []

  // Preview (read-only) against the DB whenever the parsed policies would change. Guarded against
  // out-of-order responses with a cancelled flag, since this fires on every currency toggle too.
  useEffect(() => {
    if (!userId || policies.length === 0) {
      return
    }
    let cancelled = false
    planBulkImport(userId, policies)
      .then((p) => {
        if (!cancelled) setPlan(p)
      })
      .catch((e) => {
        if (!cancelled) setPlanError(errorMessage(e, 'Could not preview the import.'))
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, raw, currencies])

  async function onFile(file: File) {
    setImportError(null)
    setDoneStats(null)
    try {
      const text = await file.text()
      setRaw(parseCsv(text))
      setFileName(file.name)
    } catch (e) {
      setRaw(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  const presentProviders = providers.filter((p) =>
    policies.some((pol) => pol.provider === p.key),
  )

  async function runImport() {
    if (!userId || policies.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const stats = await applyBulkImport(userId, policies)
      bumpNetWorth()
      setDoneStats(stats)
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
        <h1 className="text-heading font-medium text-text-primary">
          Import Insurance CSV
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {doneStats !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">Import complete.</p>
            <ul className="flex flex-col gap-1 text-body text-text-secondary">
              <li>
                {doneStats.created} new polic{doneStats.created === 1 ? 'y' : 'ies'}{' '}
                created
              </li>
              <li>
                {doneStats.added} new schedule{doneStats.added === 1 ? '' : 's'} added
              </li>
              <li>{doneStats.untouched} already up to date — left untouched</li>
            </ul>
            <p className="text-body text-text-secondary">
              They're in Insurance Policies and resolve into Monthly Entry by age.
            </p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload the wide insurance spreadsheet saved as CSV (see{' '}
              <code className="text-text-primary">
                templates/insurance-import-guide.md
              </code>
              ). Blocks without a policy number are skipped. Existing schedules are never
              deleted or replaced — a policy number new to the sheet creates a policy, a
              date new to an existing policy adds a schedule, and anything already on file
              is left alone.
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
                {policies.length === 0 ? (
                  <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
                    No importable policy blocks found.
                  </div>
                ) : (
                  <>
                    {planLoading && (
                      <p className="text-caption text-text-secondary">
                        Checking against your existing policies…
                      </p>
                    )}
                    {planError && <p className="text-caption text-danger">{planError}</p>}
                    {plan && (
                      <div className="flex flex-col gap-2">
                        <PlanBucket
                          label="New policies"
                          items={plan.toCreate}
                          open={openBucket.created}
                          onToggle={() =>
                            setOpenBucket((s) => ({ ...s, created: !s.created }))
                          }
                        />
                        <PlanBucket
                          label="New schedules"
                          items={plan.toAddSchedule}
                          open={openBucket.added}
                          onToggle={() =>
                            setOpenBucket((s) => ({ ...s, added: !s.added }))
                          }
                        />
                        <PlanBucket
                          label="Already up to date"
                          items={plan.untouched}
                          open={openBucket.untouched}
                          onToggle={() =>
                            setOpenBucket((s) => ({ ...s, untouched: !s.untouched }))
                          }
                        />
                      </div>
                    )}
                  </>
                )}

                {presentProviders.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-caption uppercase tracking-[0.08em] text-text-secondary">
                      Confirm provider currency
                    </p>
                    {presentProviders.map((p) => (
                      <div
                        key={p.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-body text-text-primary">{p.label}</span>
                        <div className="w-44">
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
                  <ul className="flex flex-col gap-1 text-caption text-warning">
                    {warns.slice(0, MAX_MESSAGES).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
                {errs.length > 0 && (
                  <ul className="flex flex-col gap-1 text-caption text-danger">
                    {errs.slice(0, MAX_MESSAGES).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {importError && <p className="text-caption text-danger">{importError}</p>}
          </>
        )}
      </div>

      <div className="border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {doneStats !== null ? (
          <PrimaryButton onClick={() => navigate(-1)} className="w-full">
            DONE
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={() => void runImport()}
            disabled={importing || planLoading || policies.length === 0}
            className="w-full"
          >
            {importing ? 'Importing…' : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>
    </Sheet>
  )
}

function PlanBucket({
  label,
  items,
  open,
  onToggle,
}: {
  label: string
  items: BulkImportItem[]
  open: boolean
  onToggle: () => void
}) {
  if (items.length === 0) return null
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-body text-text-primary"
      >
        <span>
          {label} ({items.length})
        </span>
        <span className="text-text-secondary">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1 text-caption text-text-secondary">
          {items.map((i) => (
            <li key={i.policy_number}>
              {i.policy_name || i.policy_number} ({i.policy_number})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
