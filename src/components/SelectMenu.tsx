import { useRef, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface SelectMenuProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
  /** When disabled the button can't be opened and is greyed; `placeholder` shows in place of a value. */
  disabled?: boolean
  placeholder?: string
  /** 'field' (default) — matches the `.field-control` height so dropdowns line up with form inputs
   *  and filter rows app-wide; 'compact' opts a tight spot back down to the smaller chrome. */
  size?: 'compact' | 'field'
}

/**
 * A compact dropdown: a button showing the current option's label, toggling a small menu (scrim
 * + absolute panel). Generic over string-valued options; used by the Shows Library filters + sort.
 */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  disabled = false,
  placeholder,
  size = 'field',
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false)
  // Open upward when there isn't room below the trigger (e.g. a short form clipped by overflow).
  const [flipUp, setFlipUp] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const current = options.find((o) => o.value === value)
  useEscapeKey(() => setOpen(false), open)

  const toggle = () => {
    if (disabled) return
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuH = Math.min(options.length * 40 + 8, 264)
      setFlipUp(window.innerHeight - rect.bottom < menuH && rect.top > menuH)
    }
    setOpen((o) => !o)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-1 rounded-input bg-input ${
          size === 'field' ? 'px-3 py-2 text-[15px]' : 'px-2.5 py-1.5 text-sm'
        } ${disabled ? 'text-text-tertiary' : 'text-text-primary'}`}
      >
        <span className="truncate">{current?.label ?? placeholder ?? value}</span>
        <IconChevronDown size={15} className="shrink-0 text-text-secondary" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className={`absolute left-0 z-20 max-h-64 w-full min-w-36 overflow-y-auto rounded-card border border-border bg-surface text-sm shadow-lg ${
              flipUp ? 'bottom-full mb-1' : 'mt-1'
            }`}
          >
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`block w-full px-3 py-2 text-left active:bg-input/40 ${
                  o.value === value ? 'text-accent' : 'text-text-primary'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
