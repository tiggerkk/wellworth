import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'

interface ScreenHeaderTitleProps {
  /** Plain string title, rendered in the standard header `<h1>`. Omit and pass `children` instead
   *  for a detail screen whose header carries more than a single title line. */
  title?: string
  /** Overrides the `<h1>`'s classes (e.g. a detail screen's `text-title` vs an entry form's
   *  `text-heading`, or `line-clamp-2` for a name that can wrap to two lines — see
   *  `01_design_system.md`'s type-scale table). */
  titleClassName?: string
  /** Custom header content instead of `title` — e.g. Literature's title + writer link + dynasty
   *  chip, Medical Report Detail's two-line date/type + provider block, or a search overlay's
   *  `SearchBar` in place of a title. */
  children?: ReactNode
  /** Trailing content after the title — `EntryHeaderActions`, a reservation `<div>` (see the
   *  no-shift placeholder+float pattern used by every New/Edit form and detail screen with
   *  load-dependent actions), Medical's import/edit button, Literature's favorite heart, etc. */
  actions?: ReactNode
  /** Defaults to `navigate(-1)` (routed Entry screens and Sheets unwind the same way the device
   *  Back button would); pass an explicit callback for a local overlay (no route to pop) or a
   *  screen that falls back to a fixed route when there's no history to pop (e.g. Travel's
   *  New/Edit Trip). */
  onClose?: () => void
  /** The standardized `-ml-1 p-1 text-text-secondary` (bigger tap target, flush via negative
   *  margin) — rarely overridden. */
  closeClassName?: string
  /** Defaults to "Close"; Literature passes "關閉" since that module's UI copy is in Chinese. */
  closeAriaLabel?: string
  /** Overrides the `<header>` wrapper's classes. Defaults to the standard fixed-header shell used
   *  by every Entry screen, Sheet, and local overlay in scope — content-driven height (no fixed
   *  `h-14`) so a two-line `line-clamp-2` title can grow the header naturally. */
  className?: string
}

/**
 * Shared header — close button + title (or custom `children`) + trailing `actions` — for every
 * Entry screen, routed `Sheet`, and local overlay (`OverlayTop`/`OverlayBottom`) in scope.
 * Only the `onClose` behavior differs by caller (Entry/Sheet default to `navigate(-1)`,
 * overlays pass their own handler).
 */
export function ScreenHeaderTitle({
  title,
  titleClassName = 'flex-1 truncate text-heading font-medium text-text-primary',
  children,
  actions,
  onClose,
  closeClassName = '-ml-1 p-1 text-text-secondary',
  closeAriaLabel = 'Close',
  className = 'flex items-center gap-3 border-b border-border px-4 py-3',
}: ScreenHeaderTitleProps) {
  const navigate = useNavigate()
  return (
    <header className={className}>
      <button
        onClick={onClose ?? (() => navigate(-1))}
        aria-label={closeAriaLabel}
        className={closeClassName}
      >
        <IconX size={22} />
      </button>
      {children ?? <h1 className={titleClassName}>{title}</h1>}
      {actions}
    </header>
  )
}
