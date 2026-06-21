import { useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface SelectMenuProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
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
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  useEscapeKey(() => setOpen(false), open)

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        className="flex w-full items-center justify-between gap-1 rounded-input bg-input px-2.5 py-1.5 text-sm text-text-primary"
      >
        <span className="truncate">{current?.label ?? value}</span>
        <IconChevronDown size={15} className="shrink-0 text-text-secondary" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 z-20 mt-1 max-h-64 w-full min-w-36 overflow-y-auto rounded-card border border-border bg-surface text-sm shadow-lg">
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
