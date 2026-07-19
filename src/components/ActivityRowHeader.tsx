/**
 * Standardized 2-line activity identity block — reused by the Activity Add sheet's picker list
 * and the Wellness Library's Activities tab. Presentational only; the caller supplies its own
 * wrapping element and leading icon (`resolveActivityIcon(a.icon)`).
 *
 * Line 1: Activity name
 * Line 2: Template label (Duration / Strength)
 */
import { activityTemplateLabel } from '../constants/wellness'

type ActivityRowHeaderProps = {
  activity: { name: string; template: string }
}

/** Presentational: renders the 2 lines only. Each caller wraps this in its own sizing element
 * (a `min-w-0 flex-1` span) so truncation is governed by the caller's layout, not this component. */
export function ActivityRowHeader({ activity }: ActivityRowHeaderProps) {
  return (
    <>
      <span className="block truncate text-body text-text-primary">{activity.name}</span>
      <span className="block truncate text-caption text-text-secondary">
        {activityTemplateLabel(activity.template)}
      </span>
    </>
  )
}
