interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

/**
 * Pill switch: on = coral with knob right, off = `track` with knob left. The track is a flex
 * row with a small inset (`px-0.5`); the knob is a flex child pushed left/right with `justify-*`.
 * This keeps the knob inside the track by construction — no absolute/translate maths that can
 * overflow the edge at fractional sizes.
 */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-10 shrink-0 items-center rounded-pill px-0.5 transition-colors ${
        checked ? 'justify-end bg-accent' : 'justify-start bg-track'
      }`}
    >
      <span className="size-5 rounded-full bg-white" />
    </button>
  )
}
