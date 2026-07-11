import { useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  fromIsoDate,
  startOfMonth,
  toIsoDate,
  todayLocal,
  type IsoDate,
} from '../lib/date'

interface MonthPickerProps {
  /** Currently-selected month (any civil date within it). */
  month: IsoDate
  onSelect: (month: IsoDate) => void
  onClose: () => void
}

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

/** Month/year picker: a year stepper over a 3×4 month grid. Local overlay (not a route). */
export function MonthPicker({ month, onSelect, onClose }: MonthPickerProps) {
  const selDate = fromIsoDate(startOfMonth(month))
  const selYear = selDate.getFullYear()
  const selMonth = selDate.getMonth()
  const [viewYear, setViewYear] = useState(selYear)
  const today = fromIsoDate(todayLocal())
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  // Esc cancels (close without committing).
  useEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a month"
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-card bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        {/* X (cancel) hugs the top-left; the ‹ year › cluster is centered with the arrows pulled in
            tight against the label, matching Calendar. */}
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
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
              className="p-1 text-text-secondary"
            >
              <IconChevronLeft size={20} />
            </button>
            <span className="px-2 text-body font-medium text-text-primary">
              {viewYear}
            </span>
            <button
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Next year"
              className="p-1 text-text-secondary"
            >
              <IconChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((label, i) => {
            const isSelected = viewYear === selYear && i === selMonth
            const isCurrentMonth = viewYear === todayYear && i === todayMonth
            return (
              <button
                key={label}
                onClick={() => onSelect(toIsoDate(new Date(viewYear, i, 1)))}
                className={`rounded-card py-2.5 text-body ${
                  isSelected ? 'bg-fill text-bg' : 'bg-input text-text-primary'
                } ${isCurrentMonth ? 'ring-1 ring-white' : ''}`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* "This Month" just navigates the view to the year containing the current month (tapping a
            month commits + closes; X / Esc cancel — so no Cancel/OK buttons). */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setViewYear(todayYear)}
            className="rounded-pill bg-input px-8 py-2.5 text-body text-text-primary"
          >
            This Month
          </button>
        </div>
      </div>
    </div>
  )
}
