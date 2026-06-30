import { EFFORT_LEVELS, type Effort } from '../constants/effort-levels'

interface EffortPickerProps {
  value: Effort
  onChange: (effort: Effort) => void
  /** Only effort levels the activity defines a MET for are selectable. */
  available?: Effort[]
}

/** Light / Moderate / Vigorous radio list with MET ranges. */
export function EffortPicker({ value, onChange, available }: EffortPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {EFFORT_LEVELS.map((level) => {
        const disabled = available ? !available.includes(level.key) : false
        const active = level.key === value
        return (
          <button
            key={level.key}
            disabled={disabled}
            onClick={() => onChange(level.key)}
            className={`flex items-center justify-between rounded-input border px-4 py-3 text-left ${
              active ? 'border-accent bg-input' : 'border-border bg-surface-alt'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <span className="text-body text-text-primary">{level.label}</span>
            <span className="text-caption text-text-secondary">{level.range}</span>
          </button>
        )
      })}
    </div>
  )
}
