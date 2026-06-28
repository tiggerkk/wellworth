import { useCallback, useState } from 'react'
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
  ASSET_TYPE_LABELS,
  CURRENCIES,
  DEFAULT_BIRTH_YEAR,
  DETAIL_FIELDS,
  formatHkd,
  INSURANCE_PROVIDERS,
  INSURANCE_PROVIDER_LABELS,
  originalCashValueAtAge,
  resolvePolicyAtAge,
  surrenderGainPctPerYear,
  totalBase,
  valueBase,
  varianceAtAge,
  visibleAssetTypes,
  type AssetType,
  type Currency,
  type InsuranceProvider,
} from '../lib/networth'
import { bumpNetWorth, useNetWorthVersion } from '../lib/networth-refresh'
import { fetchRateToHkd, fetchRatesToHkd, type FetchableCurrency } from '../lib/fx'
import { addMonths, formatMonthLabel, startOfMonth, todayLocal } from '../lib/date'
import { draftAmount } from '../lib/quantity'
import { routes } from '../constants/routes'
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
): EntryDraft[] {
  const age = ageForYear(Number(month.slice(0, 4)), birthYear)
  const rows: EntryDraft[] = []
  for (const { policy, schedules } of catalogue) {
    if (
      policy.surrendered_from_month &&
      month >= startOfMonth(policy.surrendered_from_month)
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
  return rows.sort((a, b) => {
    const pi =
      INSURANCE_PROVIDERS.indexOf(a.details.provider as InsuranceProvider) -
      INSURANCE_PROVIDERS.indexOf(b.details.provider as InsuranceProvider)
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
  const [month, setMonth] = useState(() => startOfMonth(todayLocal()))

  const birthYear = profile?.birthday
    ? Number(profile.birthday.slice(0, 4))
    : DEFAULT_BIRTH_YEAR
  const visibleTypes = visibleAssetTypes(
    profile?.networth_asset_type_order,
    profile?.networth_visible_asset_types,
  )

  const loadFn = useCallback(async (): Promise<
    MonthDraft & { snapshotId: string | null }
  > => {
    void version
    if (!userId) return { rows: [], fxRates: blankRates(), snapshotId: null }
    const existing = await getSnapshotWithEntries(userId, month)
    // A saved month shows its FROZEN rows (manual + fund + insurance). If it has no frozen insurance
    // yet (e.g. the snapshot was created by the manual CSV import, which never freezes insurance),
    // live-resolve insurance from the catalogue so it still appears — a Monthly Entry SAVE freezes it.
    if (existing) {
      const base = draftFromEntries(existing.entries)
      if (!base.rows.some((r) => r.asset_type === 'insurance')) {
        const catalogue = await listCatalogue(userId)
        base.rows = [...base.rows, ...resolveInsuranceRows(catalogue, month, birthYear)]
      }
      return { ...base, snapshotId: existing.snapshot.id }
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
    const insurance = resolveInsuranceRows(catalogue, month, birthYear)
    return {
      rows: [...carried, ...insurance],
      fxRates: {
        HKD: '1',
        CNY: fetched.CNY != null ? String(fetched.CNY) : (priorRows?.fxRates.CNY ?? ''),
        USD: fetched.USD != null ? String(fetched.USD) : (priorRows?.fxRates.USD ?? ''),
      },
      snapshotId: null,
    }
  }, [userId, month, version, birthYear])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* While the month loads, keep the month-nav header pinned and show Loading in the body
          below — mirrors the Wellness Diary (its day-nav header stays put during a load). */}
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
              <span className="min-w-28 px-1 py-1 text-center text-[15px] font-medium text-text-primary">
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
            <span className="block text-[11px] uppercase tracking-wide text-text-secondary">
              Net worth
            </span>
            <span className="block text-lg font-semibold text-text-tertiary">—</span>
          </div>
        </header>
      )}
      {loading && <p className="px-4 py-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 py-6 text-sm text-danger">Couldn’t load this month.</p>
      )}
      {!loading && !error && initial && (
        <EntryForm
          key={month}
          userId={userId ?? ''}
          month={month}
          setMonth={setMonth}
          initial={initial}
          initialSnapshotId={initial.snapshotId}
          visibleTypes={visibleTypes}
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
  visibleTypes,
}: {
  userId: string
  month: string
  setMonth: (m: string) => void
  initial: MonthDraft
  initialSnapshotId: string | null
  visibleTypes: AssetType[]
}) {
  const navigate = useNavigate()
  const openSheet = useSheetNavigate()
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      visibleTypes.map((t) => [t, initial.rows.some((r) => r.asset_type === t)]),
    ),
  )
  const [fundModal, setFundModal] = useState<EntryDraft | null>(null)

  const dirty = serialize(rows, fxRates) !== serialize(baseline.rows, baseline.fxRates)

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
  const total = totalBase(rows.map((r) => ({ value_base: rowBase(r) })))

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
            for (const f of DETAIL_FIELDS[r.asset_type]) {
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
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'rounded-input bg-input px-2 py-1.5 text-[15px] text-text-primary focus:outline-none'

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
              className="min-w-28 rounded-input px-1 py-1 text-center text-[15px] font-medium text-text-primary"
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
            dirty={dirty}
            saving={saving}
            onReset={reset}
            onSubmit={() => void save()}
            onDelete={initialSnapshotId ? () => void removeMonth() : undefined}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-text-secondary">
              Net worth
            </span>
            <span className="block text-lg font-semibold text-text-primary">
              {formatHkd(total)}
            </span>
          </div>
          <button
            onClick={() => openSheet(`${routes.networth.import}?month=${month}`)}
            className="flex items-center gap-1 text-sm text-positive"
          >
            <IconUpload size={16} /> Import CSV
          </button>
        </div>
      </header>

      {/* Scrolling body */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {/* Exchange rates */}
        <section className="shrink-0">
          <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            Exchange rates{' '}
            <span className="font-normal normal-case tracking-normal text-text-tertiary">
              (as of 1st of the month from Frankfurter)
            </span>
          </h2>
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="flex items-stretch gap-2 px-4 py-2.5">
              {(['CNY', 'USD'] as const).map((ccy) => (
                <div key={ccy} className="flex flex-1 items-center gap-1.5">
                  <span className="text-[15px] text-text-primary">{ccy}</span>
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
              <p className="px-4 pb-2 text-xs text-text-tertiary">
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
          return (
            <div
              key={type}
              className="shrink-0 overflow-hidden rounded-card border border-border bg-surface"
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
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
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text-primary">
                  {ASSET_TYPE_LABELS[type]}
                </span>
                {entries.length > 0 && (
                  <span className="shrink-0 text-sm text-text-secondary">
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
                    className="shrink-0 text-positive"
                  >
                    <IconUpload size={18} />
                  </button>
                )}
              </div>

              {isOpen && entries.length > 0 && (
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
                        <span className="min-w-0 flex-1 truncate text-[15px] text-text-primary">
                          {r.name}
                        </span>
                        <span className="shrink-0 text-sm text-text-secondary">
                          {formatHkd(rowBase(r))}
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs text-text-tertiary">
                          {r.details.return_rate ? `${r.details.return_rate}%` : ''}
                        </span>
                      </button>
                    ))}
                  {isInsurance && (
                    <InsuranceRows
                      rows={entries}
                      month={month}
                      rowBase={rowBase}
                      navigate={navigate}
                    />
                  )}
                </div>
              )}
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
        <div className="fixed inset-0 z-50 flex flex-col bg-bg">
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button onClick={() => setFundModal(null)} aria-label="Close">
              <IconX size={22} className="text-text-secondary" />
            </button>
            <h1 className="line-clamp-2 flex-1 text-[17px] font-medium text-text-primary">
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
  const details = DETAIL_FIELDS[row.asset_type]
  const showConversion = row.currency !== 'HKD'
  return (
    <div className="border-b border-border py-3 pl-3 pr-2 last:border-b-0">
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
          className={`no-spinner w-20 shrink-0 text-right ${inputCls}`}
        />
        <ConfirmDeleteAction label="Remove entry" onDelete={onRemove} />
      </div>
      {/* Detail fields + the HKD conversion flow inline on one wrapping line — e.g. a Stock's
          Ticker (narrow, ~3 chars) · Shares · "= HK$…" all share a row. */}
      {(details.length > 0 || showConversion) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
          {details.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-text-secondary">{f.label}</span>
              <input
                value={row.details[f.key] ?? ''}
                onChange={(e) => onDetail(f.key, e.target.value)}
                className={`${f.key === 'ticker' ? 'w-16' : 'w-24'} ${inputCls}`}
              />
            </label>
          ))}
          {showConversion && (
            <span className="ml-auto text-xs text-text-secondary">
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
  rowBase,
  navigate,
}: {
  rows: EntryDraft[]
  month: string
  rowBase: (r: EntryDraft) => number
  navigate: ReturnType<typeof useNavigate>
}) {
  return (
    <>
      {INSURANCE_PROVIDERS.map((provider) => {
        const group = rows.filter((r) => r.details.provider === provider)
        if (group.length === 0) return null
        return (
          <div key={provider}>
            <p className="bg-surface-alt px-3 py-1 text-[11px] uppercase tracking-wide text-text-secondary">
              {INSURANCE_PROVIDER_LABELS[provider]}
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
                  <span className="block truncate text-[15px] text-text-primary">
                    {r.name}
                  </span>
                  <span className="block truncate text-xs text-text-secondary">
                    {r.details.policy_number} · yr {r.details.policy_year}
                    {r.details.as_of_year ? ` · as of yr ${r.details.as_of_year}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-text-secondary">
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
