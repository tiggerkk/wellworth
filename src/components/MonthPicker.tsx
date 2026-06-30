import { useState } from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { fromIsoDate, startOfMonth, toIsoDate, type IsoDate } from '../lib/date'

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
  const [selected, setSelected] = useState<IsoDate>(startOfMonth(month))
  const selDate = fromIsoDate(selected)
  const selYear = selDate.getFullYear()
  const selMonth = selDate.getMonth()
  const [viewYear, setViewYear] = useState(selYear)

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a month"
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-card bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setViewYear((y) => y - 1)}
            aria-label="Previous year"
            className="p-1 text-text-secondary"
          >
            <IconChevronLeft size={20} />
          </button>
          <span className="text-body font-medium text-text-primary">{viewYear}</span>
          <button
            onClick={() => setViewYear((y) => y + 1)}
            aria-label="Next year"
            className="p-1 text-text-secondary"
          >
            <IconChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((label, i) => {
            const isSelected = viewYear === selYear && i === selMonth
            return (
              <button
                key={label}
                onClick={() => setSelected(toIsoDate(new Date(viewYear, i, 1)))}
                className={`rounded-card py-2.5 text-body ${
                  isSelected ? 'bg-fill text-bg' : 'bg-input text-text-primary'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-pill bg-input py-2.5 text-body text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(selected)}
            className="flex-1 rounded-pill bg-fill py-2.5 text-body font-medium text-bg"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
