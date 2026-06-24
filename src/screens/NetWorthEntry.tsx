import { useCallback, useState } from 'react'
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import {
  getSnapshotWithEntries,
  listEntriesBySnapshot,
  saveSnapshotEntries,
  type AssetEntryInput,
} from '../data/asset-entry'
import { deleteSnapshot, getLatestSnapshotBefore } from '../data/networth-snapshot'
import {
  ASSET_TYPE_LABELS,
  CURRENCIES,
  DETAIL_FIELDS,
  formatHkd,
  groupByType,
  totalBase,
  valueBase,
  type AssetType,
  type Currency,
} from '../lib/networth'
import { bumpNetWorth, useNetWorthVersion } from '../lib/networth-refresh'
import { fetchRateToHkd, fetchRatesToHkd, type FetchableCurrency } from '../lib/fx'
import { addMonths, formatMonthLabel, startOfMonth, todayLocal } from '../lib/date'
import { draftAmount } from '../lib/quantity'
import { routes } from '../constants/routes'
import { SectionCard } from '../components/SectionCard'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { MonthPicker } from '../components/MonthPicker'
import type { Json, Tables } from '../types/database'

// --- Draft model -------------------------------------------------------------------------

interface EntryDraft {
  clientId: string
  asset_type: AssetType
  name: string
  currency: Currency
  valueNative: string // editable numeric draft
  details: Record<string, string>
}
type RateDraft = Record<Currency, string>
interface MonthDraft {
  rows: EntryDraft[]
  fxRates: RateDraft
}

let uid = 0
const nextId = () => `e${++uid}`

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

/** Build an editable draft from saved entries (used for both an existing month and copy-forward). */
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

function cloneRows(rows: EntryDraft[]): EntryDraft[] {
  return rows.map((r) => ({ ...r, details: { ...r.details } }))
}

/** Stable serialization for the dirty check (excludes the non-persisted clientId). */
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
  const version = useNetWorthVersion()
  const [month, setMonth] = useState(() => startOfMonth(todayLocal()))

  const loadFn = useCallback(async (): Promise<
    MonthDraft & { snapshotId: string | null }
  > => {
    void version // refetch after an import (or SAVE) bumps the Net Worth tick
    if (!userId) return { rows: [], fxRates: blankRates(), snapshotId: null }
    const existing = await getSnapshotWithEntries(userId, month)
    // stored rates stay frozen; a saved month can be deleted from the header
    if (existing)
      return { ...draftFromEntries(existing.entries), snapshotId: existing.snapshot.id }
    // New month → copy entries forward (if any) and auto-fetch this month's FX.
    const prior = await getLatestSnapshotBefore(userId, month)
    const base = prior
      ? draftFromEntries(await listEntriesBySnapshot(prior.id))
      : { rows: [], fxRates: blankRates() }
    const fetched = await fetchRatesToHkd(month)
    return {
      rows: base.rows,
      fxRates: {
        HKD: '1',
        CNY: fetched.CNY != null ? String(fetched.CNY) : base.fxRates.CNY,
        USD: fetched.USD != null ? String(fetched.USD) : base.fxRates.USD,
      },
      snapshotId: null,
    }
  }, [userId, month, version])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {loading && <p className="px-4 py-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 py-6 text-sm text-danger">Couldn’t load this month.</p>
      )}
      {!loading && !error && initial && (
        // key=month: remount with a fresh draft when the month changes (data is current here).
        <EntryForm
          key={month}
          userId={userId ?? ''}
          month={month}
          setMonth={setMonth}
          initial={initial}
          initialSnapshotId={initial.snapshotId}
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
}: {
  userId: string
  month: string
  setMonth: (m: string) => void
  initial: MonthDraft
  initialSnapshotId: string | null
}) {
  const [rows, setRows] = useState<EntryDraft[]>(() => cloneRows(initial.rows))
  const [fxRates, setFxRates] = useState<RateDraft>(() => ({ ...initial.fxRates }))
  // Baseline for dirty/RESET; re-seated after a successful SAVE so the screen can stay open.
  const [baseline, setBaseline] = useState<MonthDraft>(() => ({
    rows: cloneRows(initial.rows),
    fxRates: { ...initial.fxRates },
  }))
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState<FetchableCurrency | null>(null)
  const [fxError, setFxError] = useState<Partial<Record<FetchableCurrency, boolean>>>({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const openSheet = useSheetNavigate()

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
  function updateRow(clientId: string, patch: Partial<EntryDraft>) {
    setRows((prev) => prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)))
  }
  function updateDetail(clientId: string, key: string, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.clientId === clientId ? { ...r, details: { ...r.details, [key]: value } } : r,
      ),
    )
  }
  function removeRow(clientId: string) {
    setRows((prev) => prev.filter((r) => r.clientId !== clientId))
  }

  async function save() {
    if (!userId) return
    setSaving(true)
    try {
      const payload: AssetEntryInput[] = rows
        .filter((r) => r.name.trim())
        .map((r, i) => {
          const fx = rateOf(r.currency)
          const native = draftAmount(r.valueNative, 0)
          const details: Record<string, string> = {}
          for (const f of DETAIL_FIELDS[r.asset_type]) {
            const v = (r.details[f.key] ?? '').trim()
            if (v) details[f.key] = v
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
      // Re-seat the baseline so dirty resets and the screen stays on this month.
      setBaseline({ rows: cloneRows(rows), fxRates: { ...fxRates } })
    } finally {
      setSaving(false)
    }
  }

  // Delete this month's saved snapshot (and its entries, via cascade). Clears the form to an empty
  // month; the screen stays open so the user can re-enter or navigate away.
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
  const groups = groupByType(rows)

  return (
    <>
      {/* Header: month nav + live total + RESET/SAVE */}
      <header className="shrink-0 border-b border-border bg-bg">
        <div className="flex items-center justify-center gap-3 px-3 pt-3">
          <button
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
            className="p-1 text-text-secondary"
          >
            <IconChevronLeft size={22} />
          </button>
          <button
            onClick={() => setPickerOpen(true)}
            aria-label="Choose month"
            className="min-w-36 rounded-input py-1 text-center text-[15px] font-medium text-text-primary"
          >
            {formatMonthLabel(month)}
          </button>
          <button
            onClick={() => changeMonth(1)}
            aria-label="Next month"
            className="p-1 text-text-secondary"
          >
            <IconChevronRight size={22} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-text-secondary">
              Net worth
            </span>
            <span className="block text-lg font-semibold text-text-primary">
              {formatHkd(total)}
            </span>
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
      </header>

      {/* Scrolling body */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <button
          onClick={() => openSheet(`${routes.networth.import}?month=${month}`)}
          className="flex shrink-0 items-center gap-1 self-end text-sm text-positive"
        >
          <IconUpload size={16} /> Import CSV
        </button>

        {/* Exchange rates */}
        <SectionCard className="shrink-0" title="Exchange rates (HKD 1.0000)">
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
            <p className="px-4 pb-1 text-xs text-text-tertiary">
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
          <p className="px-4 py-2 text-xs text-text-tertiary">
            Native → HKD as of 1st of the month from Frankfurter
          </p>
        </SectionCard>

        {rows.length === 0 && (
          <p className="shrink-0 px-1 text-xs text-text-tertiary">No entries yet</p>
        )}

        {/* Asset-type groups */}
        {groups.map(({ type, entries }) => {
          const subtotal = totalBase(entries.map((r) => ({ value_base: rowBase(r) })))
          return (
            <div
              key={type}
              className="shrink-0 overflow-hidden rounded-card border border-border bg-surface"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 text-[15px] font-medium text-text-primary">
                  {ASSET_TYPE_LABELS[type]}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  {entries.length > 0 && (
                    <span className="text-sm text-text-secondary">
                      {formatHkd(subtotal)}
                    </span>
                  )}
                  <button
                    onClick={() => addRow(type)}
                    aria-label={`Add ${ASSET_TYPE_LABELS[type]}`}
                    className="text-positive"
                  >
                    <IconPlus size={18} />
                  </button>
                </div>
              </div>

              {entries.length > 0 && (
                <div className="border-t border-border">
                  {entries.map((r) => (
                    <div
                      key={r.clientId}
                      className="border-b border-border p-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          value={r.name}
                          placeholder="Name"
                          onChange={(e) =>
                            updateRow(r.clientId, { name: e.target.value })
                          }
                          className={`flex-1 ${inputCls}`}
                        />
                        <button
                          onClick={() => removeRow(r.clientId)}
                          aria-label="Remove entry"
                          className="text-text-tertiary"
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={r.currency}
                          onChange={(e) =>
                            updateRow(r.clientId, {
                              currency: e.target.value as Currency,
                            })
                          }
                          className={inputCls}
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
                          value={r.valueNative}
                          onChange={(e) =>
                            updateRow(r.clientId, { valueNative: e.target.value })
                          }
                          className={`flex-1 text-right ${inputCls}`}
                        />
                      </div>
                      {r.currency !== 'HKD' && (
                        <p className="mt-1 text-right text-xs text-text-secondary">
                          = {formatHkd(rowBase(r))}
                        </p>
                      )}

                      {DETAIL_FIELDS[type].length > 0 && (
                        <div className="mt-2 flex flex-col gap-2">
                          {DETAIL_FIELDS[type].map((f) => (
                            <div key={f.key} className="flex items-center gap-2">
                              <span className="w-24 shrink-0 text-xs text-text-secondary">
                                {f.label}
                              </span>
                              <input
                                value={r.details[f.key] ?? ''}
                                onChange={(e) =>
                                  updateDetail(r.clientId, f.key, e.target.value)
                                }
                                className={`flex-1 ${inputCls}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
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
    </>
  )
}
