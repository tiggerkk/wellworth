import type { ReactNode } from 'react'
import { IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { SwipeRow } from './SwipeRow'

interface ListRowProps {
  /** Thumbnail/cover/icon shown at the row's start. */
  leading?: ReactNode
  /** The row's text content — typically a module-specific `*RowHeader` (e.g. `BookRowHeader`),
   * but any node works (used directly by simpler pickers). */
  children: ReactNode
  onClick?: () => void
  /** Renders a right-edge heart when supplied; omit to hide favoriting entirely for this row. */
  isFavorite?: boolean
  onToggleFavorite?: () => void
  /** Renders a swipe-to-delete affordance (via `SwipeRow`) when supplied. */
  onDelete?: () => void
  className?: string
}

/**
 * The standard listing-screen row: its own rounded/bordered card (so screens can lay rows out
 * with a gap between them) containing a leading slot, a flexible text body, and an optional right-edge
 * favorite heart. Swipe-to-delete is opt-in via `onDelete` and wraps the row internally, so callers
 * never touch `SwipeRow` directly.
 */
export function ListRow({
  leading,
  children,
  onClick,
  isFavorite,
  onToggleFavorite,
  onDelete,
  className = '',
}: ListRowProps) {
  const Tag = onClick ? 'button' : 'div'
  const content = (
    <div className="flex w-full items-center">
      <Tag
        onClick={onClick}
        className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left ${
          onClick ? 'active:bg-input/40' : ''
        }`}
      >
        {leading && <span className="shrink-0 text-text-secondary">{leading}</span>}
        <span className="min-w-0 flex-1">{children}</span>
      </Tag>
      {onToggleFavorite && (
        <button
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
          aria-pressed={isFavorite}
          className="shrink-0 pr-3"
        >
          {isFavorite ? (
            <IconHeartFilled size={20} className="text-favorite" />
          ) : (
            <IconHeart size={20} className="text-text-tertiary" />
          )}
        </button>
      )}
    </div>
  )

  return (
    <div
      className={`overflow-hidden rounded-card border border-border bg-surface ${className}`}
    >
      {onDelete ? <SwipeRow onDelete={onDelete}>{content}</SwipeRow> : content}
    </div>
  )
}
