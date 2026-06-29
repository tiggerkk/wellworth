import { IconX } from '@tabler/icons-react'
import { formatDayLabel, type IsoDate } from '../lib/date'

interface DateRangeRowProps {
  label: string
  from: IsoDate | null
  to: IsoDate | null
  onPickFrom: () => void
  onPickTo: () => void
  onClearFrom: () => void
  onClearTo: () => void
}

/**
 * A single-line filter date range — `label · From · To` — used by the Shows/Books Library filter
 * panel ("Started" / "Finished"). The buttons open the shared `Calendar`; a small ✕ clears a bound.
 */
export function DateRangeRow({
  label,
  from,
  to,
  onPickFrom,
  onPickTo,
  onClearFrom,
  onClearTo,
}: DateRangeRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-text-secondary">{label}</span>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <DateButton
          value={from}
          placeholder="From"
          onPick={onPickFrom}
          onClear={onClearFrom}
        />
        <DateButton value={to} placeholder="To" onPick={onPickTo} onClear={onClearTo} />
      </div>
    </div>
  )
}

function DateButton({
  value,
  placeholder,
  onPick,
  onClear,
}: {
  value: IsoDate | null
  placeholder: string
  onPick: () => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPick}
        className="field-control min-w-0 flex-1 truncate text-left"
      >
        {value ? (
          formatDayLabel(value)
        ) : (
          <span className="text-text-tertiary">{placeholder}</span>
        )}
      </button>
      {value && (
        <button onClick={onClear} aria-label="Clear date" className="text-text-tertiary">
          <IconX size={14} />
        </button>
      )}
    </div>
  )
}
