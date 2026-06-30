import { Suspense, useMemo, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { SecondaryButton } from './SecondaryButton'
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
import { categoryLabel } from '../lib/travel-config'
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

  async function fetchRates() {
    setFxBusy(true)
    try {
      const firstDay = tripFirstDay(
        trip,
        expenses.map((e) => e.expense_date),
      )
      const { rates: merged } = await fetchTripRates(nonHkdUsed, firstDay, rates)
      await saveRates(merged)
    } finally {
      setFxBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {expenses.length > 0 && (
        <>
          {/* Totals */}
          <SectionCard title="Totals">
            {perCurrency.map((t) => (
              <div
                key={t.currency}
                className="flex items-center justify-between border-b border-border px-3 py-2 last:border-b-0"
              >
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
            ))}
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-body font-medium text-text-primary">HKD total</span>
              <span className="text-body font-semibold text-text-primary">
                {formatHkd(hkd.cost)}
                {track && hkd.reimbursed > 0 && (
                  <span className="text-text-secondary"> · net {formatHkd(hkd.net)}</span>
                )}
              </span>
            </div>
            {hkd.missing.length > 0 && (
              <p className="border-t border-border px-3 py-2 text-caption text-warning">
                No HKD rate for {hkd.missing.join(', ')} — excluded from the total. Fetch
                or set it below.
              </p>
            )}
          </SectionCard>

          {/* FX rates → HKD */}
          {nonHkdUsed.length > 0 && (
            <SectionCard title="Conversion to HKD (trip’s first-day rate)">
              {nonHkdUsed.map((c) => {
                const r = rateFor(c, rates)
                return (
                  <div
                    key={c}
                    className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <span className="text-body text-text-secondary">{c} → HKD</span>
                    <input
                      key={`${c}:${r ?? ''}`}
                      type="number"
                      inputMode="decimal"
                      defaultValue={r ?? ''}
                      placeholder="rate"
                      onBlur={(e) => saveRate(c, e.target.value)}
                      className="field-control w-28 text-right"
                    />
                  </div>
                )
              })}
              <div className="px-3 py-2">
                <SecondaryButton
                  size="sm"
                  onClick={() => void fetchRates()}
                  disabled={fxBusy}
                >
                  <span className="inline-flex items-center gap-1">
                    <IconRefresh size={15} />{' '}
                    {fxBusy ? 'Fetching…' : 'Fetch missing rates'}
                  </span>
                </SecondaryButton>
              </div>
            </SectionCard>
          )}

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
