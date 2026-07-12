import { useState, type ComponentType, type ReactNode } from 'react'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'

interface CollapsibleProps {
  title: string
  /** Leading category icon rendered inside the toggle button, before the title (e.g. Wellness
   *  Diary's per-group icon). */
  icon?: ComponentType<{ size?: number; className?: string }>
  iconClassName?: string
  /** Extra content inside the toggle button, after the title — e.g. Wellness Diary's kcal
   *  subtotal, which (unlike Net Worth's subtotal) is part of what gets toggled, not a separate
   *  action. */
  titleSuffix?: ReactNode
  children: ReactNode
  /**
   * Accent color (CSS value, e.g. a `var(--color-*)` token) for the left stripe + tinted header.
   * Omit for a plain, uncolored header (e.g. Wellness's nutrient-facts groups).
   */
  color?: string
  /**
   * 'caption' — 11px uppercase tracked label (Wellness, Medical).
   * 'body' — readable body text (Literature, Net Worth, Travel — suits longer/CJK titles).
   * Default 'body'.
   */
  titleCase?: 'caption' | 'body'
  /**
   * 'card' — header + content share one bordered/colored box (default).
   * 'bare' — only the header gets the box; content renders outside it, undecorated. Use when
   * children are already individually card-styled (e.g. Medical Entry's `MedicalResultCard` rows),
   * so a second card isn't nested inside them.
   */
  variant?: 'card' | 'bare'
  /**
   * Trailing controls (badges, subtotals, buttons) rendered OUTSIDE the toggle button, so they
   * never trigger open/close — e.g. Net Worth's Excluded badge / subtotal / Add / Import, or
   * Travel's date pill / delete / duplicate / expenses / add.
   */
  actions?: ReactNode
  /**
   * Whether the toggle button grows to fill the row (default true), pushing `actions` flush to
   * the right edge — right for Net Worth, where actions should hug the far right. Set false when
   * `actions` needs its own internal spacer instead (Travel: the date pill should stay snug next
   * to the title, with only the trailing icon cluster pushed right).
   */
  titleGrow?: boolean
  /** Extra classes on the outer wrapper (e.g. `shrink-0` inside a scrolling flex column). */
  className?: string
  /** Extra classes on the content wrapper (e.g. Wellness's `px-4 py-1` for edge-to-edge rows). */
  bodyClassName?: string
  /** Uncontrolled initial state — for self-contained sections (Wellness, Literature, Medical). */
  defaultOpen?: boolean
  /** Controlled state — for sections whose parent owns/persists the open/closed map (Net Worth,
   *  Travel). Pass both `open` and `onOpenChange` together to control; omit both to stay uncontrolled. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Standard collapsible section header, shared by Wellness, Literature, Medical, Net Worth, and
 * Travel (replaces the former `CollapsibleSection`, `CollapsibleColorSection`, and
 * `MedicalSection`, plus the inline patterns in `Diary.tsx` / `NetWorthEntry.tsx` / `TripBuilder.tsx`).
 *
 * The click target is always the chevron + title button, which is `flex-1`: with no `actions` it
 * fills the entire header row, so click-anywhere is preserved automatically for sections with no
 * competing controls (Wellness/Literature/Medical). Any `actions` render as siblings after that
 * button and are never swallowed by the toggle (Net Worth/Travel).
 */
export function Collapsible({
  title,
  icon: Icon,
  iconClassName = '',
  titleSuffix,
  children,
  color,
  titleCase = 'body',
  variant = 'card',
  actions,
  titleGrow = true,
  className = '',
  bodyClassName = '',
  defaultOpen = false,
  open: openProp,
  onOpenChange,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen

  function toggle() {
    const next = !open
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  const titleClass =
    titleCase === 'caption'
      ? 'text-section font-medium uppercase tracking-[0.08em] text-text-secondary'
      : 'text-body font-medium text-text-primary'

  const header = (
    <div
      className="flex items-center gap-2 px-3 py-2.5"
      style={
        color
          ? { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }
          : undefined
      }
    >
      <button
        onClick={toggle}
        aria-expanded={open}
        className={`flex items-center gap-2 text-left ${titleGrow ? 'min-w-0 flex-1' : 'shrink-0'}`}
      >
        {open ? (
          <IconChevronDown size={18} className="shrink-0 text-text-secondary" />
        ) : (
          <IconChevronRight size={18} className="shrink-0 text-text-secondary" />
        )}
        {Icon && <Icon size={18} className={`shrink-0 ${iconClassName}`} />}
        <span className={`min-w-0 truncate ${titleGrow ? 'flex-1' : ''} ${titleClass}`}>
          {title}
        </span>
        {titleSuffix}
      </button>
      {actions}
    </div>
  )

  if (variant === 'bare') {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <div
          className="overflow-hidden rounded-card border border-border"
          style={color ? { borderLeft: `4px solid ${color}` } : undefined}
        >
          {header}
        </div>
        {open && children}
      </div>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-card border border-border bg-surface ${className}`}
      style={color ? { borderLeft: `4px solid ${color}` } : undefined}
    >
      {header}
      {open && (
        <div className={`border-t border-border ${bodyClassName}`}>{children}</div>
      )}
    </div>
  )
}
