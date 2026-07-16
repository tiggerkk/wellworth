import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'

interface EntryHeaderTitleProps {
  /** Plain string title, rendered in the standard header `<h1>`. Omit and pass `children` instead
   *  for a detail screen whose header carries more than a single title line. */
  title?: string
  /** Overrides the `<h1>`'s classes (e.g. a detail screen's `text-title` vs an entry form's
   *  `text-heading` — see `01_design_system.md`'s type-scale table). */
  titleClassName?: string
  /** Custom header content instead of `title` — e.g. Literature's title + writer link + dynasty
   *  chip, or Medical Report Detail's two-line date/type + provider block. */
  children?: ReactNode
  /** Trailing content after the title — `EntryHeaderActions`, a reservation `<div>`, Medical's
   *  import/edit button, Literature's favorite heart, etc. */
  actions?: ReactNode
  /** Defaults to `navigate(-1)`; pass a custom handler for a screen that falls back to a fixed
   *  route when there's no history to pop (e.g. Travel's New/Edit Trip). */
  onClose?: () => void
  /** Defaults to the standardized `-ml-1 p-1 text-text-secondary` (bigger tap target, flush via
   *  negative margin). */
  closeClassName?: string
  /** Defaults to "Close"; Literature passes "關閉" since that module's UI copy is in Chinese. */
  closeAriaLabel?: string
  /** Overrides the `<header>` wrapper's classes. Defaults to the standard fixed-header shell used
   *  everywhere in scope; only local overlays (which use `OverlayCloseButton`, not this component)
   *  differ, and are out of scope here. */
  className?: string
}

/**
 * Shared header for a non-sheet screen's fixed header: close button + title + trailing actions,
 * all inside the `<header>` itself (`SheetCloseButton` is the routed-sheet counterpart,
 * `OverlayCloseButton` the local-overlay one — both narrower, since neither owns a title or
 * actions). Every entry form and detail screen in scope shares the exact same wrapper, so this
 * component fully replaces the header markup at each call site.
 */
export function EntryHeaderTitle({
  title,
  titleClassName = 'flex-1 truncate text-heading font-medium text-text-primary',
  children,
  actions,
  onClose,
  closeClassName = '-ml-1 p-1 text-text-secondary',
  closeAriaLabel = 'Close',
  className = 'flex h-14 items-center gap-3 border-b border-border px-4 py-3',
}: EntryHeaderTitleProps) {
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
