import { useCallback, useState } from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  addDays,
  addMonths,
  fromIsoDate,
  startOfMonth,
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

/** Month-grid date picker. Presentational + optional injected cue dots. Local overlay (not a route). */
export function Calendar({ day, onSelect, onClose, loadCues }: CalendarProps) {
  const [viewMonth, setViewMonth] = useState<IsoDate>(startOfMonth(day))
  const [selected, setSelected] = useState<IsoDate>(day)
  const today = todayLocal()
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
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            aria-label="Previous month"
            className="p-1 text-text-secondary"
          >
            <IconChevronLeft size={20} />
          </button>
          <span className="text-[15px] font-medium text-text-primary">{monthLabel}</span>
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            aria-label="Next month"
            className="p-1 text-text-secondary"
          >
            <IconChevronRight size={20} />
          </button>
        </div>

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
            const isSelected = d === selected
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                className={`relative flex aspect-square items-center justify-center rounded-full text-[13px] ${
                  isSelected
                    ? 'bg-fill text-bg'
                    : isToday
                      ? 'text-accent ring-1 ring-accent'
                      : 'text-text-primary'
                }`}
              >
                {i + 1}
                {cue && (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {cue.food && <span className="size-1 rounded-full bg-positive" />}
                    {cue.activity && <span className="size-1 rounded-full bg-accent" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loadCues && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-positive" /> Food
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-accent" /> Activity
            </span>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-pill bg-input py-2.5 text-sm text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(selected)}
            className="flex-1 rounded-pill bg-fill py-2.5 text-sm font-medium text-bg"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
