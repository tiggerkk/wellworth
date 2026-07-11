import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconRefresh,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import {
  getSnapshotWithEntries,
  listEntriesBySnapshot,
  saveSnapshotEntries,
  type AssetEntryInput,
} from '../data/asset-entry'
import { deleteSnapshot, getLatestSnapshotBefore } from '../data/networth-snapshot'
import { listCatalogue, type PolicyWithSchedules } from '../data/insurance'
import {
  ageForYear,
  ASSET_TYPE_COLORS,
  ASSET_TYPE_LABELS,
  CURRENCIES,
  DEFAULT_BIRTH_YEAR,
  ASSET_DETAIL_FIELDS,
  formatHkd,
  gainLossClass,
  liquidAssetTypes,
  originalCashValueAtAge,
  resolvePolicyAtAge,
  surrenderGainPctPerYear,
  totalBase,
  valueBase,
  varianceAtAge,
  visibleAssetTypes,
  type AssetType,
  type Currency,
} from '../lib/networth'
import {
  effectiveProviders,
  providerLabel,
  type InsuranceProviderConfig,
} from '../lib/insurance-config'
import { bumpNetWorth, useNetWorthVersion } from '../lib/networth-refresh'
import { fetchRateToHkd, fetchRatesToHkd, type FetchableCurrency } from '../lib/fx'
import { addMonths, formatMonthLabel, startOfMonth, todayLocal } from '../lib/date'
import { draftAmount } from '../lib/quantity'
import { routes } from '../constants/routes'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useSessionState } from '../hooks/useSessionState'
import { useLiquidOnly } from '../hooks/useLiquidOnly'
import { Toggle } from '../components/Toggle'
import { FundDetail } from '../components/FundDetail'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { ConfirmDeleteAction } from '../components/ConfirmDeleteAction'
import { MonthPicker } from '../components/MonthPicker'
import type { Json, Tables } from '../types/database'

// --- Draft model -------------------------------------------------------------------------

interface EntryDraft {
  clientId: string
  asset_type: AssetType
  name: string
  currency: Currency
  valueNative: string
  details: Record<string, string>
}
type RateDraft = Record<Currency, string>
interface MonthDraft {
  rows: EntryDraft[]
  fxRates: RateDraft
}

let uid = 0
const nextId = () => `e${++uid}`

const READONLY_TYPES = new Set<AssetType>(['fund', 'insurance'])

function blankRates(): RateDraft {
  return { HKD: '1', CNY: '', USD: '' }
}

function detailsToStrings(details: Json): Record<string, string> {
  const out: Record<string, string> = {}
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    for (const [k, v] of Object.entries(details)) if (v != null) out[k] = String(v)
  }
  return out
}

function draftFromEntries(entries: Tables<'asset_entry'>[]): MonthDraft {
  const fxRates = blankRates()
  for (const e of entries) {
    if (e.currency === 'CNY' && e.fx_rate_to_base) fxRates.CNY = String(e.fx_rate_to_base)
    if (e.currency === 'USD' && e.fx_rate_to_base) fxRates.USD = String(e.fx_rate_to_base)
  }
  return {
    rows: entries.map((e) => ({
      clientId: nextId(),
      asset_type: e.asset_type as AssetType,
      name: e.name,
      currency: e.currency as Currency,
      valueNative: e.value_native == null ? '' : String(e.value_native),
      details: detailsToStrings(e.details),
    })),
    fxRates,
  }
}

/** Resolve live insurance rows from the catalogue for a month's age (new/unsaved months only). */
function resolveInsuranceRows(
  catalogue: PolicyWithSchedules[],
  month: string,
  birthYear: number,
  providers: InsuranceProviderConfig[],
): EntryDraft[] {
  const age = ageForYear(Number(month.slice(0, 4)), birthYear)
  const rows: EntryDraft[] = []
  for (const { policy, schedules } of catalogue) {
    // Terminated (surrendered OR matured) policies drop out from their effective month.
    if (
      policy.termination_effective_date &&
      month >= startOfMonth(policy.termination_effective_date)
    )
      continue
    const r = resolvePolicyAtAge(schedules, age)
    if (!r) continue
    const original = originalCashValueAtAge(schedules, age)
    const variance = varianceAtAge(schedules, age)
    const pct = surrenderGainPctPerYear(r.cashValue, r.premium, r.policyYear)
    rows.push({
      clientId: nextId(),
      asset_type: 'insurance',
      name: policy.policy_name || policy.policy_number,
      currency: (policy.currency as Currency) ?? 'HKD',
      valueNative: String(r.cashValue),
      details: {
        policy_id: policy.id,
        policy_number: policy.policy_number,
        provider: policy.provider,
        policy_year: String(r.policyYear),
        premium: String(r.premium),
        cash_value_original: original == null ? '' : String(original),
        variance: variance == null ? '' : String(variance),
        surrender_pct: pct.toFixed(2),
        as_of_year: r.isCarried ? String(r.asOfYear) : '',
      },
    })
  }
  // Sort by the owner's configured provider order; orphan keys (deleted providers) sort last.
  const order = new Map(providers.map((p, i) => [p.key, i]))
  const idx = (k: string | undefined) => order.get(k ?? '') ?? Number.MAX_SAFE_INTEGER
  return rows.sort((a, b) => {
    const pi = idx(a.details.provider) - idx(b.details.provider)
    return pi !== 0
      ? pi
      : (a.details.policy_number ?? '') < (b.details.policy_number ?? '')
        ? -1
        : 1
  })
}

function cloneRows(rows: EntryDraft[]): EntryDraft[] {
  return rows.map((r) => ({ ...r, details: { ...r.details } }))
}

function serialize(rows: EntryDraft[], fx: RateDraft): string {
  return JSON.stringify({
    rows: rows.map((r) => ({
      asset_type: r.asset_type,
      name: r.name,
      currency: r.currency,
      valueNative: r.valueNative,
      details: r.details,
    })),
    fx,
  })
}

// --- Screen (outer loader) ---------------------------------------------------------------

export function NetWorthEntry() {
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  const version = useNetWorthVersion()
  // Persist the selected month in sessionStorage so it survives the unmount when an Import sheet opens
  // over the entry and closes (the background tab is re-rendered from a static element map, which would
  // otherwise reset local state to the current month). Defaults to the current month on a fresh tab.
  const [month, setMonth] = useSessionState(
    'networth-entry-month',
    startOfMonth(todayLocal()),
  )

  const birthYear = profile?.birthday
    ? Number(profile.birthday.slice(0, 4))
    : DEFAULT_BIRTH_YEAR
  const providers = useMemo(
    () => effectiveProviders(profile?.insurance_providers),
    [profile?.insurance_providers],
  )
  const visibleTypes = visibleAssetTypes(
    profile?.networth_asset_type_order,
    profile?.networth_visible_asset_types,
  )
  const liquidTypes = liquidAssetTypes(profile?.networth_liquid_asset_types)

  const loadFn = useCallback(async (): Promise<
    MonthDraft & { snapshotId: string | null; needsFreeze: boolean }
  > => {
    void version
    if (!userId)
      return { rows: [], fxRates: blankRates(), snapshotId: null, needsFreeze: false }
    const existing = await getSnapshotWithEntries(userId, month)
    // A saved month shows its FROZEN rows (manual + fund + insurance). If it has no frozen insurance
    // yet (e.g. the snapshot was created by the manual CSV import, which never freezes insurance),
    // live-resolve insurance from the catalogue so it still appears — a Monthly Entry SAVE freezes it.
    if (existing) {
      const base = draftFromEntries(existing.entries)
      // When live insurance is injected into a snapshot that has none persisted, the displayed total
      // is higher than what's saved (and the Dashboard, which reads the saved snapshot, won't match).
      // Flag `needsFreeze` so SAVE is enabled even without a manual edit — pressing it freezes the
      // insurance into the snapshot and reconciles the Dashboard.
      let needsFreeze = false
      if (!base.rows.some((r) => r.asset_type === 'insurance')) {
        const catalogue = await listCatalogue(userId)
        const insurance = resolveInsuranceRows(catalogue, month, birthYear, providers)
        if (insurance.length > 0) {
          base.rows = [...base.rows, ...insurance]
          needsFreeze = true
        }
      }
      return { ...base, snapshotId: existing.snapshot.id, needsFreeze }
    }

    // New month: copy manual + fund forward; insurance is re-resolved from the catalogue. The prior
    // snapshot, the catalogue, and this month's FX are independent → fetch them concurrently.
    const [prior, catalogue, fetched] = await Promise.all([
      getLatestSnapshotBefore(userId, month),
      listCatalogue(userId),
      fetchRatesToHkd(month),
    ])
    const priorRows = prior
      ? draftFromEntries(await listEntriesBySnapshot(prior.id))
      : null
    const carried = (priorRows?.rows ?? []).filter((r) => r.asset_type !== 'insurance')
    const insurance = resolveInsuranceRows(catalogue, month, birthYear, providers)
    const newRows = [...carried, ...insurance]
    return {
      rows: newRows,
      fxRates: {
        HKD: '1',
        CNY: fetched.CNY != null ? String(fetched.CNY) : (priorRows?.fxRates.CNY ?? ''),
        USD: fetched.USD != null ? String(fetched.USD) : (priorRows?.fxRates.USD ?? ''),
      },
      snapshotId: null,
      // A brand-new month is entirely unpersisted — enable SAVE so the copied-forward snapshot can be
      // created without first editing a value.
      needsFreeze: newRows.length > 0,
    }
  }, [userId, month, version, birthYear, providers])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* While the month loads, keep the month-nav header pinned and show Loading in the body
          below — its day-nav header stays put during a load. */}
      {(loading || error) && (
        <header className="shrink-0 border-b border-border bg-bg">
          <div className="flex items-center px-3 pt-2">
            <div className="flex flex-1 items-center justify-center gap-1">
              <button
                onClick={() => setMonth(addMonths(month, -1))}
                aria-label="Previous month"
                className="p-1 text-text-secondary"
              >
                <IconChevronLeft size={20} />
              </button>
              <span className="min-w-28 px-1 py-1 text-center text-body font-medium text-text-primary">
                {formatMonthLabel(month)}
              </span>
              <button
                onClick={() => setMonth(addMonths(month, 1))}
                aria-label="Next month"
                className="p-1 text-text-secondary"
              >
                <IconChevronRight size={20} />
              </button>
            </div>
          </div>
          <div className="px-4 py-2">
            <span className="block text-section uppercase tracking-wide text-text-secondary">
              Net worth
            </span>
            <span className="block text-title font-semibold text-text-tertiary">—</span>
          </div>
        </header>
      )}
      {loading && <p className="px-4 py-6 text-body text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 py-6 text-body text-danger">Couldn’t load this month.</p>
      )}
      {!loading && !error && initial && (
        <EntryForm
          key={month}
          userId={userId ?? ''}
          month={month}
          setMonth={setMonth}
          initial={initial}
          initialSnapshotId={initial.snapshotId}
          initialNeedsFreeze={initial.needsFreeze}
          visibleTypes={visibleTypes}
          liquidTypes={liquidTypes}
          providers={providers}
        />
      )}
    </div>
  )
}

// --- Form (inner) ------------------------------------------------------------------------

function EntryForm({
  userId,
  month,
  setMonth,
  initial,
  initialSnapshotId,
  initialNeedsFreeze,
  visibleTypes,
  liquidTypes,
  providers,
}: {
  userId: string
  month: string
  setMonth: (m: string) => void
  initial: MonthDraft
  initialSnapshotId: string | null
  initialNeedsFreeze: boolean
  visibleTypes: AssetType[]
  liquidTypes: AssetType[]
  providers: InsuranceProviderConfig[]
}) {
  const navigate = useNavigate()
  const openSheet = useSheetNavigate()
  const [liquidOnly, setLiquidOnly] = useLiquidOnly()
  const [rows, setRows] = useState<EntryDraft[]>(() => cloneRows(initial.rows))
  const [fxRates, setFxRates] = useState<RateDraft>(() => ({ ...initial.fxRates }))
  const [baseline, setBaseline] = useState<MonthDraft>(() => ({
    rows: cloneRows(initial.rows),
    fxRates: { ...initial.fxRates },
  }))
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState<FetchableCurrency | null>(null)
  const [fxError, setFxError] = useState<Partial<Record<FetchableCurrency, boolean>>>({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expanded, setExpanded] = useSessionState<Record<string, boolean>>(
    'networth-entry-expanded',
    Object.fromEntries(
      visibleTypes.map((t) => [t, initial.rows.some((r) => r.asset_type === t)]),
    ),
  )
  const [fundModal, setFundModal] = useState<EntryDraft | null>(null)
  // True when the loaded rows differ from what's persisted (live insurance injected into a snapshot
  // with none frozen, or a brand-new month) — SAVE must be enabled even before any manual edit so the
  // snapshot can be frozen/created. Cleared once SAVE persists the current rows as the new baseline.
  const [needsFreeze, setNeedsFreeze] = useState(initialNeedsFreeze)

  // The Dashboard's fund detail is a routed `Sheet` (closes on Esc + browser-back for free); this
  // local modal isn't a route, so wire the same Esc dismissal (shared LIFO handler).
  useEscapeKey(() => setFundModal(null), fundModal != null)

  const dirty = serialize(rows, fxRates) !== serialize(baseline.rows, baseline.fxRates)
  const canSave = dirty || needsFreeze

  async function refreshRate(ccy: FetchableCurrency) {
    setFetching(ccy)
    setFxError((e) => ({ ...e, [ccy]: false }))
    try {
      const rate = await fetchRateToHkd(ccy, month, { force: true })
      setFxRates((prev) => ({ ...prev, [ccy]: String(rate) }))
    } catch {
      setFxError((e) => ({ ...e, [ccy]: true }))
    } finally {
      setFetching(null)
    }
  }

  const rateOf = (currency: Currency) =>
    currency === 'HKD' ? 1 : draftAmount(fxRates[currency], 0)
  const rowBase = (r: EntryDraft) =>
    valueBase(draftAmount(r.valueNative, 0), rateOf(r.currency))
  // "Liquid Only" view excludes non-liquid types from the displayed total (their sections stay
  // visible/editable below and are marked "Excluded"). SAVE is unaffected — this only changes what
  // the header total reflects, never what's persisted.
  const total = totalBase(
    rows
      .filter((r) => !liquidOnly || liquidTypes.includes(r.asset_type))
      .map((r) => ({ value_base: rowBase(r) })),
  )

  function reset() {
    setRows(cloneRows(baseline.rows))
    setFxRates({ ...baseline.fxRates })
  }

  function changeMonth(delta: number) {
    if (dirty && !window.confirm('Discard unsaved changes for this month?')) return
    setMonth(addMonths(month, delta))
  }
  function goToMonth(target: string) {
    const m = startOfMonth(target)
    setPickerOpen(false)
    if (m === month) return
    if (dirty && !window.confirm('Discard unsaved changes for this month?')) return
    setMonth(m)
  }

  function addRow(type: AssetType) {
    setExpanded((e) => ({ ...e, [type]: true }))
    setRows((prev) => [
      ...prev,
      {
        clientId: nextId(),
        asset_type: type,
        name: '',
        currency: 'HKD',
        valueNative: '',
        details: {},
      },
    ])
  }
  const updateRow = (clientId: string, patch: Partial<EntryDraft>) =>
    setRows((prev) => prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)))
  const updateDetail = (clientId: string, key: string, value: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.clientId === clientId ? { ...r, details: { ...r.details, [key]: value } } : r,
      ),
    )
  const removeRow = (clientId: string) =>
    setRows((prev) => prev.filter((r) => r.clientId !== clientId))

  async function save() {
    if (!userId) return
    setSaving(true)
    try {
      const payload: AssetEntryInput[] = rows
        .filter((r) => r.name.trim())
        .map((r, i) => {
          const fx = rateOf(r.currency)
          const native = draftAmount(r.valueNative, 0)
          let details: Record<string, string> = {}
          if (READONLY_TYPES.has(r.asset_type)) {
            details = { ...r.details } // fund/insurance carry their full detail set
          } else {
            for (const f of ASSET_DETAIL_FIELDS[r.asset_type]) {
              const v = (r.details[f.key] ?? '').trim()
              if (v) details[f.key] = v
            }
          }
          return {
            asset_type: r.asset_type,
            name: r.name.trim(),
            currency: r.currency,
            details,
            value_native: native,
            fx_rate_to_base: fx,
            value_base: valueBase(native, fx),
            sort_order: i,
          }
        })
      await saveSnapshotEntries(userId, month, payload)
      bumpNetWorth()
      setBaseline({ rows: cloneRows(rows), fxRates: { ...fxRates } })
      setNeedsFreeze(false) // rows are now persisted — no pending freeze
    } finally {
      setSaving(false)
    }
  }

  async function removeMonth() {
    if (!initialSnapshotId) return
    setSaving(true)
    try {
      await deleteSnapshot(initialSnapshotId)
      bumpNetWorth()
      setRows([])
      setBaseline({ rows: [], fxRates: { ...fxRates } })
      setNeedsFreeze(false)
    } finally {
      setSaving(false)
    }
  }

  // Shared single-line field standard — see `.field-control` in index.css.
  const inputCls = 'field-control'

  return (
    <>
      {/* Header: compact month nav + actions on one line, then NET WORTH total + Import CSV */}
      <header className="shrink-0 border-b border-border bg-bg">
        <div className="flex items-center px-3 pt-2">
          <div className="flex flex-1 items-center justify-center gap-1">
            <button
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
              className="p-1 text-text-secondary"
            >
              <IconChevronLeft size={20} />
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              aria-label="Choose month"
              className="min-w-28 rounded-input px-1 py-1 text-center text-body font-medium text-text-primary"
            >
              {formatMonthLabel(month)}
            </button>
            <button
              onClick={() => changeMonth(1)}
              aria-label="Next month"
              className="p-1 text-text-secondary"
            >
              <IconChevronRight size={20} />
            </button>
          </div>
          <EntryHeaderActions
            editing
            dirty={canSave}
            saving={saving}
            onReset={reset}
            onSubmit={() => void save()}
            onDelete={initialSnapshotId ? () => void removeMonth() : undefined}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <div>
            <span className="block text-section uppercase tracking-wide text-text-secondary">
              Net worth
            </span>
            <span className="block text-title font-semibold text-text-primary">
              {formatHkd(total)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-label text-text-secondary">Liquid Only</span>
              <Toggle checked={liquidOnly} onChange={setLiquidOnly} label="Liquid only" />
            </label>
            <button
              onClick={() => openSheet(`${routes.networth.import}?month=${month}`)}
              className="flex items-center gap-1 text-body text-accent"
            >
              <IconUpload size={16} /> Import
            </button>
          </div>
        </div>
      </header>

      {/* Scrolling body */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {/* Exchange rates */}
        <section className="shrink-0">
          <h2 className="mb-2 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
            Exchange rates{' '}
            <span className="font-normal normal-case tracking-normal text-text-tertiary">
              (as of 1st of the month from Frankfurter)
            </span>
          </h2>
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="flex items-stretch gap-2 px-4 py-2.5">
              {(['CNY', 'USD'] as const).map((ccy) => (
                <div key={ccy} className="flex flex-1 items-center gap-1.5">
                  <span className="text-body text-text-primary">{ccy}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    placeholder="rate"
                    value={fxRates[ccy]}
                    onChange={(e) => {
                      const v = e.target.value
                      setFxRates((prev) => ({ ...prev, [ccy]: v }))
                      setFxError((er) => ({ ...er, [ccy]: false }))
                    }}
                    className={`w-0 min-w-0 flex-1 text-right ${inputCls}`}
                  />
                  <button
                    onClick={() => void refreshRate(ccy)}
                    disabled={fetching === ccy}
                    aria-label={`Refresh ${ccy} rate`}
                    className="shrink-0 text-text-secondary disabled:opacity-50"
                  >
                    <IconRefresh size={16} />
                  </button>
                </div>
              ))}
            </div>
            {(['CNY', 'USD'] as const).some((c) => fetching === c || fxError[c]) && (
              <p className="px-4 pb-2 text-caption text-text-tertiary">
                {(['CNY', 'USD'] as const)
                  .map((c) =>
                    fetching === c
                      ? `${c}: fetching…`
                      : fxError[c]
                        ? `${c}: couldn’t fetch — enter manually.`
                        : null,
                  )
                  .filter(Boolean)
                  .join('  ')}
              </p>
            )}
          </div>
        </section>

        {/* Asset-type sections (visible, ordered, collapsible) */}
        {visibleTypes.map((type) => {
          const entries = rows.filter((r) => r.asset_type === type)
          const subtotal = totalBase(entries.map((r) => ({ value_base: rowBase(r) })))
          const isOpen = expanded[type] ?? false
          const isFund = type === 'fund'
          const isInsurance = type === 'insurance'
          const isManual = !READONLY_TYPES.has(type)
          // In the "Liquid Only" view, non-liquid sections stay visible/editable but don't count
          // toward the header total — flag them so the header can mark them "Excluded".
          const excluded = liquidOnly && !liquidTypes.includes(type)
          return (
            <div
              key={type}
              className="shrink-0 overflow-hidden rounded-card border border-border bg-surface"
              style={{ borderLeft: `4px solid ${ASSET_TYPE_COLORS[type]}` }}
            >
              <div
                className="flex items-center gap-2 px-3 py-2.5"
                style={{
                  backgroundColor: `color-mix(in srgb, ${ASSET_TYPE_COLORS[type]} 14%, transparent)`,
                }}
              >
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [type]: !isOpen }))}
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                  className="text-text-secondary"
                >
                  {isOpen ? (
                    <IconChevronDown size={18} />
                  ) : (
                    <IconChevronRight size={18} />
                  )}
                </button>
                <span className="min-w-0 flex-1 truncate text-body font-medium text-text-primary">
                  {ASSET_TYPE_LABELS[type]}
                </span>
                {excluded && (
                  <span className="shrink-0 rounded-pill bg-input px-2 py-0.5 text-caption text-text-tertiary">
                    Excluded
                  </span>
                )}
                {entries.length > 0 && (
                  <span className="shrink-0 text-body text-text-secondary">
                    {formatHkd(subtotal)}
                  </span>
                )}
                {isManual && (
                  <button
                    onClick={() => addRow(type)}
                    aria-label={`Add ${ASSET_TYPE_LABELS[type]}`}
                    className="shrink-0 text-positive"
                  >
                    <IconPlus size={18} />
                  </button>
                )}
                {isFund && (
                  <button
                    onClick={() =>
                      openSheet(`${routes.networth.importFund}?month=${month}`)
                    }
                    aria-label="Import funds CSV"
                    className="shrink-0 text-accent"
                  >
                    <IconUpload size={18} />
                  </button>
                )}
                {isInsurance && (
                  <span
                    className="shrink-0"
                    style={{ width: 18, height: 18 }}
                    aria-hidden="true"
                  />
                )}
              </div>

              {isOpen &&
                (entries.length === 0 ? (
                  <p className="border-t border-border px-4 py-3 text-caption text-text-tertiary">
                    Nothing logged.
                  </p>
                ) : (
                  <div className="border-t border-border">
                    {isManual &&
                      entries.map((r) => (
                        <ManualRow
                          key={r.clientId}
                          row={r}
                          inputCls={inputCls}
                          rowBaseHkd={rowBase(r)}
                          onChange={(patch) => updateRow(r.clientId, patch)}
                          onDetail={(k, v) => updateDetail(r.clientId, k, v)}
                          onRemove={() => removeRow(r.clientId)}
                        />
                      ))}
                    {isFund &&
                      entries.map((r) => (
                        <button
                          key={r.clientId}
                          onClick={() => setFundModal(r)}
                          className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 active:bg-input/40"
                        >
                          <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                            {r.name}
                          </span>
                          <span className="shrink-0 text-body text-text-secondary">
                            {formatHkd(rowBase(r))}
                          </span>
                          <span
                            className={`w-12 shrink-0 text-right text-caption ${
                              r.details.return_rate
                                ? gainLossClass(Number(r.details.return_rate))
                                : 'text-text-tertiary'
                            }`}
                          >
                            {r.details.return_rate ? `${r.details.return_rate}%` : ''}
                          </span>
                        </button>
                      ))}
                    {isInsurance && (
                      <InsuranceRows
                        rows={entries}
                        month={month}
                        providers={providers}
                        rowBase={rowBase}
                        navigate={navigate}
                      />
                    )}
                  </div>
                ))}
            </div>
          )
        })}
      </div>

      {pickerOpen && (
        <MonthPicker
          month={month}
          onSelect={goToMonth}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {fundModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)]">
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button onClick={() => setFundModal(null)} aria-label="Close">
              <IconX size={22} className="text-text-secondary" />
            </button>
            <h1 className="line-clamp-2 flex-1 text-heading font-medium text-text-primary">
              {fundModal.name}
            </h1>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            <FundDetail
              data={{
                name: fundModal.name,
                valueHkd: rowBase(fundModal),
                details: fundModal.details,
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

// --- Manual (editable) row ---------------------------------------------------------------

function ManualRow({
  row,
  inputCls,
  rowBaseHkd,
  onChange,
  onDetail,
  onRemove,
}: {
  row: EntryDraft
  inputCls: string
  rowBaseHkd: number
  onChange: (patch: Partial<EntryDraft>) => void
  onDetail: (key: string, value: string) => void
  onRemove: () => void
}) {
  const details = ASSET_DETAIL_FIELDS[row.asset_type]
  const showConversion = row.currency !== 'HKD'
  return (
    <div className="border-b border-border py-3 pr-1 pl-3 last:border-b-0">
      {/* Name · CCY · Value · Delete on one line; the trash hugs the right edge */}
      <div className="flex items-center gap-2">
        <input
          value={row.name}
          placeholder="Name"
          onChange={(e) => onChange({ name: e.target.value })}
          className={`min-w-0 flex-1 ${inputCls}`}
        />
        <select
          value={row.currency}
          onChange={(e) => onChange({ currency: e.target.value as Currency })}
          className={`shrink-0 ${inputCls}`}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          placeholder="Value"
          value={row.valueNative}
          onChange={(e) => onChange({ valueNative: e.target.value })}
          className={`no-spinner w-24 shrink-0 text-right ${inputCls}`}
        />
        <ConfirmDeleteAction label="Remove entry" onDelete={onRemove} />
      </div>
      {/* Detail fields + the HKD conversion flow inline on one wrapping line — e.g. a Stock's
          Ticker (narrow, ~3 chars) · Shares · "= HK$…" all share a row. */}
      {(details.length > 0 || showConversion) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
          {details.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5">
              <span className="shrink-0 text-caption text-text-secondary">{f.label}</span>
              <input
                value={row.details[f.key] ?? ''}
                onChange={(e) => onDetail(f.key, e.target.value)}
                // Maturity Date holds a full date (e.g. 2027-06-15) — wide enough to show it all;
                // ticker is ~3 chars; other details default to a medium box.
                className={`${
                  f.key === 'ticker'
                    ? 'w-16'
                    : f.key === 'maturity_date'
                      ? 'w-40'
                      : 'w-24'
                } ${inputCls}`}
              />
            </label>
          ))}
          {showConversion && (
            <span className="ml-auto text-caption text-text-secondary">
              = {formatHkd(rowBaseHkd)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// --- Insurance (read-only) rows, grouped by provider -------------------------------------

function InsuranceRows({
  rows,
  month,
  providers,
  rowBase,
  navigate,
}: {
  rows: EntryDraft[]
  month: string
  providers: InsuranceProviderConfig[]
  rowBase: (r: EntryDraft) => number
  navigate: ReturnType<typeof useNavigate>
}) {
  // Group by the configured providers in order, then any orphan-keyed rows (deleted providers) last.
  const orphanKeys = [
    ...new Set(
      rows
        .map((r) => r.details.provider ?? '')
        .filter((k) => !providers.some((p) => p.key === k)),
    ),
  ]
  const groups = [...providers.map((p) => p.key), ...orphanKeys]
  return (
    <>
      {groups.map((provider) => {
        const group = rows.filter((r) => r.details.provider === provider)
        if (group.length === 0) return null
        return (
          <div key={provider}>
            <p className="bg-surface-alt px-3 py-1 text-section uppercase tracking-wide text-text-secondary">
              {providerLabel(providers, provider)}
            </p>
            {group.map((r) => (
              <button
                key={r.clientId}
                onClick={() =>
                  navigate(
                    `${routes.networth.policy(r.details.policy_id ?? '')}?month=${month}`,
                  )
                }
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 active:bg-input/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-text-primary">
                    {r.details.policy_number} · yr {r.details.policy_year}
                    {r.details.as_of_year ? ` · as of yr ${r.details.as_of_year}` : ''}
                  </span>
                  <span className="block truncate text-caption text-text-secondary">
                    {providerLabel(providers, provider)} · {r.name}
                  </span>
                </span>
                <span className="shrink-0 text-body text-text-secondary">
                  {formatHkd(rowBase(r))}
                </span>
              </button>
            ))}
          </div>
        )
      })}
    </>
  )
}
