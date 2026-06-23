interface PinInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  autoFocus?: boolean
  ariaLabel?: string
}

/**
 * A masked numeric PIN field (digits only, max 8). Shared by the lock screen and the lock settings
 * (set / change / confirm). Enter submits. `inputMode="numeric"` raises the digit keypad on mobile.
 */
export function PinInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  ariaLabel,
}: PinInputProps) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      aria-label={ariaLabel ?? 'PIN'}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit?.()
      }}
      className="w-full rounded-input bg-input px-3 py-2.5 text-center text-lg tracking-[0.3em] text-text-primary placeholder:tracking-normal placeholder:text-text-tertiary focus:outline-none"
    />
  )
}
