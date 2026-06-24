import { IconPlus } from '@tabler/icons-react'
import { Link } from 'react-router'

interface EmptyStateProps {
  /** The "No X yet" line. */
  title: string
  /** The action pill text, e.g. "+ New Show" (the + glyph is the leading icon). */
  actionLabel: string
  /** Route the action navigates to. */
  to: string
}

/**
 * Vertically-centered empty state for the media Dashboards/Libraries: a muted title line over a
 * "+ New X" action pill. The host must give its content region `flex-1` so this centers between
 * the sticky header and the bottom nav.
 */
export function EmptyState({ title, actionLabel, to }: EmptyStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm text-text-secondary">{title}</p>
      <Link
        to={to}
        className="flex items-center gap-1 rounded-pill bg-input px-3 py-1.5 text-sm text-accent"
      >
        <IconPlus size={16} /> {actionLabel.replace(/^\+\s*/, '')}
      </Link>
    </div>
  )
}
