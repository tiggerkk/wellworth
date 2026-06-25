import type { ReactNode } from 'react'

/**
 * The collapsible filter-panel "pane" shared across modules — a bordered surface card. Render it
 * conditionally when the `FilterToggleButton` is active; lay out dropdowns/date rows + the
 * Sort/Clear-Filters footer inside.
 */
export function FilterPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 text-xs">
      {children}
    </div>
  )
}
