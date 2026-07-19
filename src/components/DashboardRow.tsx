import type { ReactNode } from 'react'

interface DashboardRowProps {
  /** Thumbnail/cover shown at the row's start. */
  leading?: ReactNode
  /** The row's text content — typically a module-specific `*RowHeader`. */
  children: ReactNode
  onClick: () => void
  /** Optional trailing control (e.g. a quick-action button). */
  action?: ReactNode
}

/**
 * The standard Dashboard shelf row: hairline-divided, sitting inside a shared `SectionCard`
 * (Favourites / Currently Reading / etc.), unlike `ListRow` which is its own separate card.
 * Dashboards intentionally keep this grouped look rather than the Library's gapped-card layout —
 * it visually ties rows to their section.
 */
export function DashboardRow({ leading, children, onClick, action }: DashboardRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
      {leading}
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        {children}
      </button>
      {action}
    </div>
  )
}
