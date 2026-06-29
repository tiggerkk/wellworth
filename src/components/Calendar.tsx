import { useCallback, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  addDays,
  addMonths,
  fromIsoDate,
  startOfMonth,
  toIsoDate,
  todayLocal,
  type IsoDate,
} from '../lib/date'

export interface DayCue {
  food?: boolean
  activity?: boolean
}

interface CalendarProps {
  day: IsoDate
  onSelect: (day: IsoDate) => void
  onClose: () => void
  /**
   * Optional cue-dot loader for the visible month (passed `monthStart`..`monthEnd`). Provide it
   * to draw per-day dots + a legend (Wellness Diary); omit it for a plain date picker (Shows).
   */
  loadCues?: (monthStart: IsoDate, monthEnd: IsoDate) => Promise<Map<IsoDate, DayCue>>
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
/** Years shown per page in the year-grid mode (3×4); the ◀/▶ arrows step a whole page at a time. */
const YEAR_PAGE = 12

/** Month-grid date picker. Presentational + optional injected cue dots. Local overlay (not a route). */
export function Calendar({ day, onSelect, onClose, loadCues }: CalendarProps) {
  const [viewMonth, setViewMonth] = useState<IsoDate>(startOfMonth(day))
  // Tapping the month-year header opens the month grid; tapping its year opens a paged year grid —
  // so jumping to a distant year (e.g. a birthday) is a few page taps, not dozens of single steps.
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days')
  const [pickYear, setPickYear] = useState(() => fromIsoDate(viewMonth).getFullYear())
  // Top-left year of the current year-grid page (only meaningful in 'years' mode).
  const [yearBase, setYearBase] = useState(() => pickYear - Math.floor(YEAR_PAGE / 2))
  const today = todayLocal()
  // Esc cancels (close without committing).
  useEscapeKey(onClose)

  const monthStart = fromIsoDate(viewMonth)
  const year = monthStart.getFullYear()
  const monthIndex = monthStart.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const leadingBlanks = monthStart.getDay()

  const rangeEnd = addDays(addMonths(viewMonth, 1), -1)
  const cuesFn = useCallback(() => {
    if (!loadCues) return Promise.resolve(new Map<IsoDate, DayCue>())
    return loadCues(viewMonth, rangeEnd)
  }, [loadCues, viewMonth, rangeEnd])
  const { data: cues } = useAsync(cuesFn)

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(monthStart)

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a date"
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-card bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        {/* X (cancel) hugs the top-left; the ‹ label › cluster is centered with the arrows pulled in
            tight against the label. */}
        <div className="relative mb-3 flex items-center justify-center">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute left-0 p-1 text-text-secondary"
          >
            <IconX size={22} />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                mode === 'days'
                  ? setViewMonth(addMonths(viewMonth, -1))
                  : mode === 'months'
                    ? setPickYear((y) => y - 1)
                    : setYearBase((b) => b - YEAR_PAGE)
              }
              aria-label={
                mode === 'days'
                  ? 'Previous month'
                  : mode === 'months'
                    ? 'Previous year'
                    : 'Previous years'
              }
              className="p-1 text-text-secondary"
            >
              <IconChevronLeft size={20} />
            </button>
            {mode === 'days' && (
              <button
                onClick={() => {
                  setPickYear(year)
                  setMode('months')
                }}
                className="rounded-input px-2 py-0.5 text-[15px] font-medium text-text-primary active:bg-input/40"
              >
                {monthLabel}
              </button>
            )}
            {mode === 'months' && (
              <button
                onClick={() => {
                  setYearBase(pickYear - Math.floor(YEAR_PAGE / 2))
                  setMode('years')
                }}
                aria-label="Choose year"
                className="rounded-input px-2 py-0.5 text-[15px] font-medium text-text-primary active:bg-input/40"
              >
                {pickYear}
              </button>
            )}
            {mode === 'years' && (
              <span className="px-2 text-[15px] font-medium text-text-primary">
                {yearBase}–{yearBase + YEAR_PAGE - 1}
              </span>
            )}
            <button
              onClick={() =>
                mode === 'days'
                  ? setViewMonth(addMonths(viewMonth, 1))
                  : mode === 'months'
                    ? setPickYear((y) => y + 1)
                    : setYearBase((b) => b + YEAR_PAGE)
              }
              aria-label={
                mode === 'days'
                  ? 'Next month'
                  : mode === 'months'
                    ? 'Next year'
                    : 'Next years'
              }
              className="p-1 text-text-secondary"
            >
              <IconChevronRight size={20} />
            </button>
          </div>
        </div>

        {mode === 'years' ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: YEAR_PAGE }, (_, i) => yearBase + i).map((yr) => (
              <button
                key={yr}
                onClick={() => {
                  setPickYear(yr)
                  setMode('months')
                }}
                className={`rounded-card py-2.5 text-[15px] ${
                  yr === pickYear ? 'bg-fill text-bg' : 'bg-input text-text-primary'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        ) : mode === 'months' ? (
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((label, i) => {
              const isCurrent = pickYear === year && i === monthIndex
              return (
                <button
                  key={label}
                  onClick={() => {
                    setViewMonth(toIsoDate(new Date(pickYear, i, 1)))
                    setMode('days')
                  }}
                  className={`rounded-card py-2.5 text-[15px] ${
                    isCurrent ? 'bg-fill text-bg' : 'bg-input text-text-primary'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-text-tertiary">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = `${viewMonth.slice(0, 8)}${String(i + 1).padStart(2, '0')}`
                const cue = cues?.get(d)
                const isToday = d === today
                // The date that was set before opening (the `day` prop) reads as the current
                // selection — accent-filled; today gets a white ring (both can apply at once).
                const isSelected = d === day
                return (
                  <button
                    key={d}
                    onClick={() => onSelect(d)}
                    className={`relative flex aspect-square items-center justify-center rounded-full text-[13px] ${
                      isSelected ? 'bg-accent text-white' : 'text-text-primary'
                    } ${isToday ? 'ring-1 ring-white' : ''}`}
                  >
                    {i + 1}
                    {cue && (
                      <span className="absolute bottom-1 flex gap-0.5">
                        {cue.food && <span className="size-1 rounded-full bg-positive" />}
                        {cue.activity && (
                          <span className="size-1 rounded-full bg-accent" />
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {mode === 'days' && loadCues && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-positive" /> Food
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-accent" /> Activity
            </span>
          </div>
        )}

        {/* "Today" just navigates the view to the current month's day grid (tapping a day commits +
            closes; X / Esc cancel — so no Cancel/OK buttons). */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => {
              setViewMonth(startOfMonth(today))
              setPickYear(fromIsoDate(today).getFullYear())
              setMode('days')
            }}
            className="rounded-pill bg-input px-8 py-2.5 text-sm text-text-primary"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  )
}
