import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeKey } from '../hooks/useEscapeKey'

export interface ColorOption {
  name: string
  value: string
}

const COLS = 5
const SWATCH = 24 // px, matches size-6
const GAP = 8 // px, matches gap-2 / p-2
const MARGIN = 4 // px gap between the trigger and the popover

/**
 * A compact swatch color picker: a round swatch button that opens a small popover grid of colour
 * options (a scrim closes it; Esc via the shared `useEscapeKey` stack). The popover is **portaled to
 * `document.body`** and positioned `fixed` from the trigger's rect — it must escape the ancestors that
 * would otherwise hide it: the `ReorderList` container's `overflow-hidden` (clips) and each reorder
 * row's `transform` (a per-row stacking context that paints later rows over an in-flow popover). It
 * flips **above** the trigger when there isn't room below. Presentational + controlled — the parent
 * owns `value` and persists in `onChange`. Used by Net Worth Manage Providers, Quotes Categories, and
 * Travel Expense-Categories editor (`ConfigListEditor` `rowExtra`) to set each category's donut colour.
 */
export function ColorPicker({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly ColorOption[]
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  useEscapeKey(() => setOpen(false), open)

  const rows = Math.ceil(options.length / COLS)
  // Popover box: content + p-2 padding + 1px border each side.
  const popoverH = rows * SWATCH + (rows - 1) * GAP + 2 * GAP + 2

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const below = r.bottom + MARGIN
      // Flip above when the popover would run past the viewport bottom and there's more room up top.
      const flipUp =
        below + popoverH > window.innerHeight && r.top > window.innerHeight - r.bottom
      setPos({
        top: flipUp ? r.top - popoverH - MARGIN : below,
        right: window.innerWidth - r.right, // right-align the popover's right edge to the trigger's
      })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex size-7 items-center justify-center rounded-full border border-border"
      >
        <span
          className="size-4 rounded-full"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              style={{ top: pos.top, right: pos.right }}
              className="fixed z-50 grid grid-cols-5 gap-2 rounded-card border border-border bg-surface p-2 shadow-lg"
            >
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  aria-label={o.name}
                  aria-pressed={o.value === value}
                  title={o.name}
                  className={`size-6 rounded-full border-2 ${
                    o.value === value ? 'border-text-primary' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: o.value }}
                />
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
