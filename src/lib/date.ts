/**
 * Local civil-date helpers. The diary `day` column is a civil date ('YYYY-MM-DD'),
 * never an instant. The cardinal rule: never feed a bare 'YYYY-MM-DD' to `new Date()`
 * (it parses as UTC midnight → off-by-one in negative-offset zones). Always build from
 * numeric parts (local) and format from local parts (never via toISOString).
 */
export type IsoDate = string

/** Format a Date's LOCAL calendar day as 'YYYY-MM-DD'. */
export function toIsoDate(d: Date): IsoDate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today as a local civil date. */
export function todayLocal(): IsoDate {
  return toIsoDate(new Date())
}

/** Parse 'YYYY-MM-DD' to a Date at LOCAL midnight (avoids the UTC off-by-one). */
export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** Add (or subtract) whole calendar days, returning a civil date (DST-safe). */
export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = fromIsoDate(iso)
  d.setDate(d.getDate() + n)
  return toIsoDate(d)
}

/** Month + day only, e.g. 'Jun 13' (no weekday, no Today/Yesterday) — Shows/Books recent + library rows. */
export function formatMonthDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(fromIsoDate(iso))
}

/** Full civil date with year, e.g. 'Jun 13, 2024' — for records that span years (Medical reports). */
export function formatFullDate(iso: IsoDate): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(fromIsoDate(iso))
}

/** 'Today' / 'Yesterday' / 'Tomorrow', else the canonical `MMM DD, YYYY` — Wellness Diary nav only. */
export function formatDayLabel(iso: IsoDate, today: IsoDate = todayLocal()): string {
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  return formatFullDate(iso)
}

/** First day of the month containing `iso`, as a civil date. */
export function startOfMonth(iso: IsoDate): IsoDate {
  const [y, m] = iso.split('-').map(Number)
  return toIsoDate(new Date(y ?? 1970, (m ?? 1) - 1, 1))
}

/** Add `n` months to the first-of-month of `iso` (used by the calendar grid). */
export function addMonths(iso: IsoDate, n: number): IsoDate {
  const [y, m] = iso.split('-').map(Number)
  return toIsoDate(new Date(y ?? 1970, (m ?? 1) - 1 + n, 1))
}

/** Format the month of a civil date as e.g. 'June 2026' (local parts). */
export function formatMonthLabel(iso: IsoDate): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(fromIsoDate(iso))
}

/** Short month label for chart ticks, e.g. `Jun ’26`. */
export function formatMonthShort(iso: IsoDate): string {
  const s = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
  }).format(fromIsoDate(iso))
  return s.replace(/(\d\d)$/, '’$1')
}
