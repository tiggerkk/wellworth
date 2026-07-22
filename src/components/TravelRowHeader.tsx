/**
 * Standardized 2-line trip identity block — reused by both the Travel Dashboard shelves and the
 * Library. Presentational only; the caller supplies its own wrapping element, thumbnail, and the
 * pre-resolved primary place label (`primaryLabel(facetsByTrip.get(trip.id))`) since that lookup
 * depends on data the caller already has assembled.
 *
 * Line 1: Trip name
 * Line 2: Status chip · Date range · Primary place label (if any)
 */
import { TRIP_STATUS_CHIP, tripStatusLabel, type TripRow } from '../lib/travel'
import { formatFullDate, formatMonthDay } from '../lib/date'
import { StatusChip } from './StatusChip'

type TravelRowHeaderProps = {
  trip: Pick<TripRow, 'name' | 'status' | 'start_date' | 'end_date'>
  /** Pre-resolved primary place label, e.g. from `primaryLabel(facetsByTrip.get(trip.id))`. */
  label?: string | null
}

function dateRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatMonthDay(start)} – ${formatFullDate(end)}`
  if (start) return formatFullDate(start)
  return 'No dates yet'
}

/** Presentational: renders the 2 lines only. Each caller wraps this in its own sizing element
 * (a `min-w-0 flex-1` div) so truncation is governed by the caller's layout, not this component. */
export function TravelRowHeader({ trip, label }: TravelRowHeaderProps) {
  return (
    <>
      <span className="block truncate text-body text-text-primary">{trip.name}</span>
      <div className="flex items-center gap-1.5">
        <StatusChip
          label={tripStatusLabel(trip.status)}
          className={TRIP_STATUS_CHIP[trip.status as keyof typeof TRIP_STATUS_CHIP]}
        />
        <p className="truncate text-caption text-text-secondary">
          {dateRange(trip.start_date, trip.end_date)}
          {label ? ` · ${label}` : ''}
        </p>
      </div>
    </>
  )
}
