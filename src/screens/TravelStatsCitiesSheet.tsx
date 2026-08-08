import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { SheetLoader } from '../components/SheetLoader'
import { computeCityVisitStats, type StatFacetRow } from '../lib/travel-stats'
import type { TripRow } from '../lib/travel'

interface StatsLocationState {
  trips: TripRow[]
  facetRows: StatFacetRow[]
  // `useSheetNavigate` also merges in `background`; unused here.
}

/**
 * Routed drill-in for the Travel Dashboard's "中国城市" KPI tile. Reuses the Dashboard's
 * already-loaded `trips`/`facetRows` (passed via `useSheetNavigate`'s route `state`) — no fetch of
 * its own. Table grouped by province (municipalities, provinces, autonomous regions, then SARs;
 * city asc within each) so the row order never depends on trip counts and stays stable across opens.
 */
export function TravelStatsCitiesSheet() {
  const location = useLocation()
  const state = location.state as StatsLocationState | null

  const rows = useMemo(
    () => (state ? computeCityVisitStats(state.trips, state.facetRows) : null),
    [state],
  )

  return (
    <SheetLoader
      label="China cities"
      title={rows ? `${rows.length} 中国城市` : '中国城市'}
      loading={false}
      data={rows}
      errorText="Couldn’t load this from the dashboard — go back and try again."
    >
      {(d) => (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem] gap-2 border-b border-border px-3 py-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">
              <span className="text-center">中国省份</span>
              <span className="text-center">中国城市</span>
              <span className="text-center"># of Trips</span>
            </div>
            <div className="divide-y divide-border">
              {d.length === 0 ? (
                <p className="px-3 py-6 text-body text-text-tertiary">
                  No China cities visited yet.
                </p>
              ) : (
                d.map((row) => (
                  <div
                    key={`${row.province}\u0000${row.city}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem] gap-2 px-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-center text-body text-text-secondary">
                      {row.province}
                    </span>
                    <span className="min-w-0 truncate text-center text-body text-text-primary">
                      {row.city}
                    </span>
                    <span className="text-center text-body text-text-secondary">
                      {row.tripCount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </SheetLoader>
  )
}
