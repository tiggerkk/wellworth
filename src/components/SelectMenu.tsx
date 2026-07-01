import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

/** Fixed-position placement for the portaled menu, measured from the trigger's rect. */
interface MenuPos {
  left: number
  width: number
  maxH: number
  /** Anchored from the top (open down) or the bottom (flipped up). */
  top?: number
  bottom?: number
}

/**
 * A compact dropdown: a button showing the current option's label, toggling a small menu (scrim
 * + panel). Generic over string-valued options; used by the Library filters/sort and the entry forms.
 *
 * The menu is **portaled to `document.body`** and positioned `fixed` from the trigger's rect — it must
 * escape its ancestors: a `.field-control` row's `overflow`, a `ReorderList` row's `transform`
 * (a stacking context), and an `opacity < 1` wrapper (which would render the panel semi-transparent —
 * e.g. the dimmed add-expense row). It flips **above** the trigger when there isn't room below, and
 * its max-height is capped to the space actually available on the chosen side.
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
  const [pos, setPos] = useState<MenuPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const current = options.find((o) => o.value === value)
  useEscapeKey(() => setOpen(false), open)

  const toggle = () => {
    if (disabled) return
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const fullH = options.length * 40 + 8
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      // Flip up only when below can't fit the list and above has more room; size to that side.
      const up = spaceBelow < fullH && spaceAbove > spaceBelow
      setPos({
        left: rect.left,
        width: rect.width,
        maxH: Math.min(fullH, up ? spaceAbove : spaceBelow),
        ...(up
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    setOpen((o) => !o)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-1 rounded-input bg-input ${
          size === 'field' ? 'px-3 py-2 text-body' : 'px-2.5 py-1.5 text-body'
        } ${disabled ? 'text-text-tertiary' : 'text-text-primary'}`}
      >
        <span className="truncate">{current?.label ?? placeholder ?? value}</span>
        <IconChevronDown size={15} className="shrink-0 text-text-secondary" />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              style={{
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxH,
                top: pos.top,
                bottom: pos.bottom,
              }}
              className="fixed z-50 min-w-36 overflow-y-auto rounded-card border border-border bg-surface text-body shadow-lg"
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
          </>,
          document.body,
        )}
    </div>
  )
}
