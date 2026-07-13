/**
 * Per-trip FX orchestration — freezes one HKD rate per currency at the trip's **first day** so the HKD
 * total is reproducible. Builds on the shared Frankfurter client (`fetchRateToHkdOn` in `src/lib/fx.ts`);
 * the rates are persisted on `trip.fx_rates` by the caller. A currency Frankfurter can't price (e.g. a
 * non-ECB currency, or offline) is returned in `failed` so the UI offers a manual override.
 */
import { fetchRateToHkdOn } from './fx'
import { todayLocal, type IsoDate } from './date'
import type { RateMap } from './travel-expenses'
import type { TripRow } from './travel'

/** The date all of a trip's rates are taken at: the cached start date, else the earliest dated expense,
 * else today. Pure. */
export function tripFirstDay(
  trip: Pick<TripRow, 'start_date'>,
  expenseDates: (string | null)[],
): IsoDate {
  if (trip.start_date) return trip.start_date
  const dated = expenseDates.filter((d): d is string => d != null).sort()
  return dated[0] ?? todayLocal()
}

/**
 * Ensure a rate exists for every currency, fetching the missing ones at `firstDay`. Returns the merged
 * rate map plus the currencies that couldn't be priced (left for a manual override). `force` refetches
 * all. Never throws — a failed leg just lands in `failed`.
 */
export async function fetchTripRates(
  currencies: string[],
  firstDay: IsoDate,
  existing: RateMap,
  opts: { force?: boolean } = {},
): Promise<{ rates: RateMap; failed: string[] }> {
  const rates: RateMap = { ...existing }
  const failed: string[] = []
  for (const currency of currencies) {
    if (currency === 'HKD') continue
    if (!opts.force && typeof rates[currency] === 'number') continue
    try {
      rates[currency] = await fetchRateToHkdOn(currency, firstDay, { force: opts.force })
    } catch {
      failed.push(currency)
    }
  }
  return { rates, failed }
}
