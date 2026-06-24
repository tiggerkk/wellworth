import { startOfMonth, type IsoDate } from './date'

/**
 * FX rates via Frankfurter (https://frankfurter.dev) — keyless, ECB-sourced, CORS-enabled
 * (browser-callable like Open Food Facts). We fetch native→HKD as of the **1st of the month**;
 * Frankfurter returns the most recent rate on or before a non-trading day. CNY is the stored
 * currency code (no RMB→CNY mapping needed). HKD→HKD is always 1 and never fetched.
 */
const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1'
const TIMEOUT_MS = 8000

export type FetchableCurrency = 'CNY' | 'USD'

/** Frankfurter URL for `from`→HKD on the 1st of `month`'s month. Pure (exported for tests). */
export function fxUrl(from: FetchableCurrency, month: IsoDate): string {
  return `${FRANKFURTER_BASE}/${startOfMonth(month)}?from=${from}&to=HKD`
}

interface FrankfurterResponse {
  rates?: Record<string, number>
}

/** Extract a finite, positive HKD rate from a Frankfurter response. Pure (exported for tests). */
export function parseFrankfurterRate(json: unknown): number {
  const rate = (json as FrankfurterResponse)?.rates?.HKD
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Frankfurter response missing a valid HKD rate')
  }
  return rate
}

// Cache by (month-1st, currency) so stepping months back and forth doesn't refetch.
const cache = new Map<string, number>()

/** native→HKD rate for `from` on the month's 1st (cached; `force` bypasses the cache). */
export async function fetchRateToHkd(
  from: FetchableCurrency,
  month: IsoDate,
  opts: { force?: boolean } = {},
): Promise<number> {
  const key = `${startOfMonth(month)}|${from}`
  if (!opts.force) {
    const cached = cache.get(key)
    if (cached != null) return cached
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(fxUrl(from, month), { signal: controller.signal })
    if (!res.ok) throw new Error(`Frankfurter request failed (${res.status})`)
    const rate = parseFrankfurterRate(await res.json())
    cache.set(key, rate)
    return rate
  } finally {
    clearTimeout(timer)
  }
}

/**
 * native→HKD rate for any currency as of a **specific civil date** (Frankfurter returns the rate on or
 * before that date — i.e. the nearest prior business day for weekends/holidays). HKD→HKD is always 1 and
 * never fetched. Cached by `${date}|${currency}` (distinct from the month-1st keys above). Used by Travel
 * (`src/lib/trip-fx.ts`) to freeze one rate per currency at a trip's first day. Throws if the currency
 * isn't priced (e.g. a non-ECB currency) — callers fall back to a manual override.
 */
export async function fetchRateToHkdOn(
  currency: string,
  date: IsoDate,
  opts: { force?: boolean } = {},
): Promise<number> {
  if (currency === 'HKD') return 1
  const key = `${date}|${currency}`
  if (!opts.force) {
    const cached = cache.get(key)
    if (cached != null) return cached
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${FRANKFURTER_BASE}/${date}?from=${currency}&to=HKD`, {
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Frankfurter request failed (${res.status})`)
    const rate = parseFrankfurterRate(await res.json())
    cache.set(key, rate)
    return rate
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch CNY+USD native→HKD for a month; a failed leg resolves to null (non-fatal). */
export async function fetchRatesToHkd(
  month: IsoDate,
): Promise<{ CNY: number | null; USD: number | null }> {
  const [cny, usd] = await Promise.allSettled([
    fetchRateToHkd('CNY', month),
    fetchRateToHkd('USD', month),
  ])
  return {
    CNY: cny.status === 'fulfilled' ? cny.value : null,
    USD: usd.status === 'fulfilled' ? usd.value : null,
  }
}
