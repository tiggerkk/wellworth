import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { SectionCard } from './SectionCard'
import { ExpenseRowsEditor, type ExpenseDraft } from './ExpenseRowsEditor'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { updateTrip } from '../data/travel'
import { bumpTravel } from '../lib/travel-refresh'
import {
  categoryTotalsHkd,
  currenciesUsed,
  formatHkd,
  formatMoney,
  hkdTotals,
  perCurrencyTotals,
  rateFor,
  type ExpenseRow,
  type ExpenseUpdate,
  type RateMap,
} from '../lib/expenses'
import { categoryColor, categoryLabel } from '../lib/travel-config'
import type { TravelCategoryConfig } from '../lib/travel-config'
import { fetchTripRates, tripFirstDay } from '../lib/trip-fx'
import { todayLocal } from '../lib/date'
import { CURRENCIES } from '../constants/travel'
import type { TripRow } from '../lib/travel'

const TravelExpenseChart = lazyWithReload(() =>
  import('./TravelExpenseChart').then((m) => ({ default: m.TravelExpenseChart })),
)

interface Props {
  trip: TripRow
  /** The trip's expenses (lifted to TripBuilder; ordered by expense_date, sort_order). */
  expenses: ExpenseRow[]
  categories: TravelCategoryConfig[]
  defaultCurrency: string
  onAdd: (draft: ExpenseDraft) => void
  onUpdate: (id: string, patch: ExpenseUpdate) => void
  onDelete: (id: string) => void
  onReorder: (orderedIds: string[]) => void
}

/**
 * The trip-level Expenses hub: per-currency + HKD totals, FX rates, the By-Category donut, and the
 * full ledger grouped by date (inline add/edit/reorder via the shared `ExpenseRowsEditor`). The expense
 * list itself lives in TripBuilder's optimistic state — the same source the per-day modal edits — so
 * the two stay in sync without a refetch. FX-rate edits stay local here (optimistic on `trip.fx_rates`).
 */
export function TripExpensesPanel({
  trip,
  expenses,
  categories,
  defaultCurrency,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: Props) {
  // FX-rate override: edits/fetches update this instantly and persist in the background; reset when a
  // real `trip.fx_rates` lands (React's adjust-state-during-render pattern, not an effect).
  const [rateOverride, setRateOverride] = useState<RateMap | null>(null)
  const [syncedFx, setSyncedFx] = useState(trip.fx_rates)
  if (syncedFx !== trip.fx_rates) {
    setRateOverride(null)
    setSyncedFx(trip.fx_rates)
  }
  const [fxBusy, setFxBusy] = useState(false)

  const rates = useMemo(
    () => rateOverride ?? (trip.fx_rates as RateMap | null) ?? {},
    [rateOverride, trip.fx_rates],
  )
  const perCurrency = useMemo(() => perCurrencyTotals(expenses), [expenses])
  const hkd = useMemo(() => hkdTotals(expenses, rates), [expenses, rates])
  const nonHkdUsed = useMemo(
    () => currenciesUsed(expenses).filter((c) => c !== 'HKD'),
    [expenses],
  )
  const slices = useMemo(
    () =>
      categoryTotalsHkd(expenses, rates).map((c) => ({
        label: categoryLabel(categories, c.key),
        hkd: c.hkd,
        color: categoryColor(categories, c.key),
      })),
    [expenses, rates, categories],
  )
  const track = trip.track_reimbursement

  async function saveRates(next: RateMap) {
    setRateOverride(next)
    try {
      await updateTrip(trip.id, { fx_rates: next })
    } catch {
      bumpTravel() // resync from server on a failed write
    }
  }

  function saveRate(currency: string, value: string) {
    const n = Number(value)
    const next: RateMap = { ...rates }
    if (value.trim() && Number.isFinite(n) && n > 0) next[currency] = n
    else delete next[currency]
    void saveRates(next)
  }

  // Auto-fill any missing rate on open / when a new foreign currency appears, so the HKD total just
  // works without hunting for a button. Frozen first-day rates and manual overrides are left untouched
  // (we fetch gaps only). `fetchingRef` dedupes concurrent runs (incl. StrictMode's double-invoke) so
  // we never deadlock or double-fetch; a currency Frankfurter can't price (offline / non-ECB) stays in
  // `missing` but keeps `missingKey` stable, so the effect doesn't re-fire — it's left for a manual rate
  // or the Refresh action. fxBusy always clears in `finally`, even after unmount (a harmless no-op).
  const fetchingRef = useRef(false)
  const missingKey = hkd.missing.join(',')
  useEffect(() => {
    if (!missingKey || fetchingRef.current) return
    fetchingRef.current = true
    setFxBusy(true)
    const firstDay = tripFirstDay(
      trip,
      expenses.map((e) => e.expense_date),
    )
    void fetchTripRates(hkd.missing, firstDay, rates)
      .then(({ rates: merged }) => saveRates(merged))
      .finally(() => {
        fetchingRef.current = false
        setFxBusy(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey])

  // Manual refresh: re-pull every foreign currency to its latest first-day rate (overwrites manual
  // overrides — a deliberate user action, unlike the gap-only auto-fetch above).
  async function refreshRates() {
    setFxBusy(true)
    try {
      const firstDay = tripFirstDay(
        trip,
        expenses.map((e) => e.expense_date),
      )
      const { rates: merged } = await fetchTripRates(nonHkdUsed, firstDay, rates, {
        force: true,
      })
      await saveRates(merged)
    } finally {
      setFxBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {expenses.length > 0 && (
        <>
          {/* Totals — per-currency native sums, each foreign currency carrying its own editable
              first-day rate + live HKD subtotal inline (no separate conversion card), then the HKD
              total. Rates auto-fetch on open; the footer refreshes them to the latest. */}
          <SectionCard title="Totals">
            {perCurrency.map((t) => {
              const rate = rateFor(t.currency, rates)
              const subtotal = rate != null ? t.cost * rate : null
              return (
                <div
                  key={t.currency}
                  className="border-b border-border px-3 py-2 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body text-text-secondary">{t.currency}</span>
                    <span className="text-body text-text-primary">
                      {formatMoney(t.cost, t.currency)}
                      {track && t.reimbursed > 0 && (
                        <span className="text-text-secondary">
                          {' '}
                          · net {formatMoney(t.net, t.currency)}
                        </span>
                      )}
                    </span>
                  </div>
                  {t.currency !== 'HKD' && (
                    <div className="mt-1.5 flex items-center gap-2 text-caption text-text-secondary">
                      <span className="shrink-0">1 {t.currency} =</span>
                      <input
                        key={`${t.currency}:${rate ?? ''}`}
                        type="number"
                        inputMode="decimal"
                        defaultValue={rate ?? ''}
                        placeholder="rate"
                        aria-label={`${t.currency} to HKD rate`}
                        onBlur={(e) => saveRate(t.currency, e.target.value)}
                        className="field-control h-8 w-24 text-right"
                      />
                      <span className="ml-auto text-right">
                        {subtotal != null ? (
                          <span className="text-text-primary">
                            = {formatHkd(subtotal)}
                          </span>
                        ) : (
                          <span className="text-warning">set a rate</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-body font-medium text-text-primary">HKD total</span>
              <span className="text-body font-semibold text-text-primary">
                {formatHkd(hkd.cost)}
                {track && hkd.reimbursed > 0 && (
                  <span className="text-text-secondary"> · net {formatHkd(hkd.net)}</span>
                )}
              </span>
            </div>
            {nonHkdUsed.length > 0 && (
              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                <span
                  className={`text-caption ${
                    !fxBusy && hkd.missing.length > 0
                      ? 'text-warning'
                      : 'text-text-tertiary'
                  }`}
                >
                  {fxBusy
                    ? 'Fetching rates…'
                    : hkd.missing.length > 0
                      ? `Couldn’t fetch ${hkd.missing.join(', ')} — set a rate above`
                      : 'Rates frozen at the trip’s first day'}
                </span>
                <button
                  onClick={() => void refreshRates()}
                  disabled={fxBusy}
                  aria-label="Refresh rates"
                  className="inline-flex shrink-0 items-center gap-1 text-caption text-text-secondary disabled:opacity-50"
                >
                  <IconRefresh size={15} className={fxBusy ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            )}
          </SectionCard>

          {/* Category breakdown */}
          {slices.length > 0 && (
            <SectionCard title="By Category (HKD)">
              <div className="p-2">
                <Suspense
                  fallback={
                    <div className="grid h-[200px] place-items-center text-body text-text-secondary">
                      Loading chart…
                    </div>
                  }
                >
                  <TravelExpenseChart data={slices} />
                </Suspense>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Full ledger — grouped by date, inline add/edit/reorder. The spend total lives here; stop
          costs are never summed. */}
      <ExpenseRowsEditor
        expenses={expenses}
        groupByDate
        categories={categories}
        currencies={CURRENCIES}
        defaultCurrency={defaultCurrency}
        defaultDate={trip.start_date ?? todayLocal()}
        trackReimbursement={track}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onReorder={onReorder}
      />
    </section>
  )
}
