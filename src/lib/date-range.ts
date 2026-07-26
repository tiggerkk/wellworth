/**
 * Shared "dashboard interval" building blocks — a `{key,label}` range option resolving to a
 * `{from,to}` IsoDate window anchored on today. Used by any module's Dashboard range-selector
 * dropdown (Wellness, Journal); pulled out here once a second module needed the same shape so the
 * two don't drift.
 */
import { addDays, fromIsoDate, toIsoDate, type IsoDate } from './date'

export interface DateRange {
  from: IsoDate
  to: IsoDate
}

export interface RangeOption {
  key: string
  label: string
  toRange: (today: IsoDate) => DateRange
}

export const lastNDays =
  (n: number) =>
  (today: IsoDate): DateRange => ({ from: addDays(today, -(n - 1)), to: today })

export const monthsAgo =
  (n: number) =>
  (today: IsoDate): DateRange => {
    const d = fromIsoDate(today)
    d.setMonth(d.getMonth() - n)
    return { from: toIsoDate(d), to: today }
  }
