interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

/** Pill switch: on = coral with knob right, off = `track` with knob left. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-pill transition-colors ${
        checked ? 'bg-accent' : 'bg-track'
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
