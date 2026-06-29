import { Suspense, useCallback, useMemo, useState } from 'react'
import { IconPlus, IconRefresh } from '@tabler/icons-react'
import { SwipeRow } from './SwipeRow'
import { SecondaryButton } from './SecondaryButton'
import { SectionCard } from './SectionCard'
import { ExpenseEditorSheet } from './ExpenseEditorSheet'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { deleteExpense, listExpenses, updateTrip } from '../data/travel'
import { bumpTravel, useTravelVersion } from '../lib/travel-refresh'
import {
  categoryTotalsHkd,
  currenciesUsed,
  formatHkd,
  formatMoney,
  hkdTotals,
  perCurrencyTotals,
  rateFor,
  type ExpenseRow,
  type RateMap,
} from '../lib/expenses'
import { categoryLabel, effectiveCategories } from '../lib/travel-config'
import { fetchTripRates, tripFirstDay } from '../lib/trip-fx'
import { formatMonthDay } from '../lib/date'
import type { TripRow } from '../lib/travel'

const TravelExpenseChart = lazyWithReload(() =>
  import('./TravelExpenseChart').then((m) => ({ default: m.TravelExpenseChart })),
)

interface Props {
  trip: TripRow
  userId: string
}

export function TripExpensesPanel({ trip, userId }: Props) {
  const version = useTravelVersion()
  const { data: profile } = useProfile()
  const categories = useMemo(
    () => effectiveCategories(profile?.travel_expense_categories ?? null),
    [profile],
  )

  const fn = useCallback(() => {
    void version
    return listExpenses(trip.id)
  }, [trip.id, version])
  const { data, loading, error } = useAsync(fn)

  // Optimistic overrides: expense add/edit/delete and FX-rate edits update these instantly and persist
  // in the background (no `bumpTravel()` → no full refetch). Each override is reset to `null` whenever a
  // real fetch lands (initial load, or an error-triggered bump), so the panel follows server truth then.
  // Drop each override when a real fetch lands (initial load / error bump) so we follow server truth.
  // React's "adjust state during render" pattern, not an effect (avoids cascading renders).
  const [expenseOverride, setExpenseOverride] = useState<ExpenseRow[] | null>(null)
  const [rateOverride, setRateOverride] = useState<RateMap | null>(null)
  const [synced, setSynced] = useState<{ data: typeof data; fx: typeof trip.fx_rates }>({
    data,
    fx: trip.fx_rates,
  })
  if (synced.data !== data || synced.fx !== trip.fx_rates) {
    if (synced.data !== data) setExpenseOverride(null)
    if (synced.fx !== trip.fx_rates) setRateOverride(null)
    setSynced({ data, fx: trip.fx_rates })
  }
  const expenses = useMemo(() => expenseOverride ?? data ?? [], [expenseOverride, data])

  const [editor, setEditor] = useState<{ expense?: ExpenseRow } | null>(null)
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

  async function removeExpense(id: string) {
    setExpenseOverride((prev) => (prev ?? data ?? []).filter((e) => e.id !== id))
    try {
      await deleteExpense(id)
    } catch {
      bumpTravel()
    }
  }

  if (loading) return <p className="px-1 py-4 text-sm text-text-secondary">Loading…</p>
  if (error)
    return <p className="px-1 py-4 text-sm text-danger">Couldn’t load expenses.</p>

  return (
    <section className="flex flex-col gap-4">
      <SecondaryButton size="sm" onClick={() => setEditor({})}>
        <span className="inline-flex items-center gap-1 text-positive">
          <IconPlus size={15} /> Add Expense
        </span>
      </SecondaryButton>

      {expenses.length === 0 ? (
        <p className="px-1 text-sm text-text-secondary">
          No expenses yet. The trip’s spend total lives here — stop costs are never
          summed.
        </p>
      ) : (
        <>
          {/* Totals */}
          <SectionCard title="Totals">
            {perCurrency.map((t) => (
              <div
                key={t.currency}
                className="flex items-center justify-between border-b border-border px-3 py-2 last:border-b-0"
              >
                <span className="text-sm text-text-secondary">{t.currency}</span>
                <span className="text-sm text-text-primary">
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
              <span className="text-[15px] font-medium text-text-primary">HKD total</span>
              <span className="text-[15px] font-semibold text-text-primary">
                {formatHkd(hkd.cost)}
                {track && hkd.reimbursed > 0 && (
                  <span className="text-text-secondary"> · net {formatHkd(hkd.net)}</span>
                )}
              </span>
            </div>
            {hkd.missing.length > 0 && (
              <p className="border-t border-border px-3 py-2 text-xs text-warning">
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
                    <span className="text-sm text-text-secondary">{c} → HKD</span>
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
                    <div className="grid h-[200px] place-items-center text-sm text-text-secondary">
                      Loading chart…
                    </div>
                  }
                >
                  <TravelExpenseChart data={slices} />
                </Suspense>
              </div>
            </SectionCard>
          )}

          {/* Expense rows */}
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            {expenses.map((e) => {
              const net = e.cost - (e.reimbursed_amount ?? 0)
              return (
                <SwipeRow key={e.id} onDelete={() => void removeExpense(e.id)}>
                  <button
                    onClick={() => setEditor({ expense: e })}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] text-text-primary">
                        {e.description}
                      </div>
                      <div className="truncate text-xs text-text-secondary">
                        {e.expense_date ? `${formatMonthDay(e.expense_date)} · ` : ''}
                        {categoryLabel(categories, e.category)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[15px] text-text-primary">
                        {formatMoney(e.cost, e.currency)}
                      </div>
                      {track && e.reimbursed_amount != null && (
                        <div className="text-xs text-text-secondary">
                          net {formatMoney(net, e.currency)}
                        </div>
                      )}
                    </div>
                  </button>
                </SwipeRow>
              )
            })}
          </div>
        </>
      )}

      {editor && (
        <ExpenseEditorSheet
          userId={userId}
          tripId={trip.id}
          defaultCurrency={trip.base_currency}
          categories={categories}
          trackReimbursement={track}
          expense={editor.expense}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setEditor(null)
            // Merge optimistically: replace on edit, prepend on add (newest-first; remount re-sorts).
            setExpenseOverride((prev) => {
              const base = prev ?? data ?? []
              return base.some((e) => e.id === saved.id)
                ? base.map((e) => (e.id === saved.id ? saved : e))
                : [saved, ...base]
            })
          }}
          onDelete={
            editor.expense
              ? () => {
                  void removeExpense(editor.expense!.id)
                  setEditor(null)
                }
              : undefined
          }
        />
      )}
    </section>
  )
}
