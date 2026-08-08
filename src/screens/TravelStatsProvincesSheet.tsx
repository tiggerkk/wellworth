import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { SheetLoader } from '../components/SheetLoader'
import {
  computeProvinceVisitStats,
  CHINA_PROVINCE_TOTAL,
  type StatFacetRow,
} from '../lib/travel-stats'
import type { TripRow } from '../lib/travel'

interface StatsLocationState {
  trips: TripRow[]
  facetRows: StatFacetRow[]
  // `useSheetNavigate` also merges in `background`; unused here.
}

/**
 * Routed drill-in for the Travel Dashboard's "中国省份" KPI tile. Reuses the Dashboard's
 * already-loaded `trips`/`facetRows` (passed via `useSheetNavigate`'s route `state`) — no fetch of
 * its own. Table of visited provinces (trip count desc, province asc tie-break) + a plain list of
 * not-yet-visited provinces (asc).
 */
export function TravelStatsProvincesSheet() {
  const location = useLocation()
  const state = location.state as StatsLocationState | null

  const stats = useMemo(
    () => (state ? computeProvinceVisitStats(state.trips, state.facetRows) : null),
    [state],
  )

  return (
    <SheetLoader
      label="China provinces"
      title={
        stats ? `${stats.visited.length} / ${CHINA_PROVINCE_TOTAL} 中国省份` : '中国省份'
      }
      loading={false}
      data={stats}
      errorText="Couldn’t load this from the dashboard — go back and try again."
    >
      {(d) => (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 border-b border-border px-3 py-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">
              <span className="text-center">中国省份</span>
              <span className="text-center"># of Trips</span>
            </div>
            <div className="divide-y divide-border">
              {d.visited.length === 0 ? (
                <p className="px-3 py-6 text-body text-text-tertiary">
                  No China provinces visited yet.
                </p>
              ) : (
                d.visited.map((row) => (
                  <div
                    key={row.province}
                    className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 px-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-center text-body text-text-primary">
                      {row.province}
                    </span>
                    <span className="text-center text-body text-text-secondary">
                      {row.tripCount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {d.unvisited.length > 0 && (
            <div className="mt-4">
              <p className="px-1 pb-1.5 text-section uppercase tracking-wide text-text-secondary">
                Not Yet Visited
              </p>
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                <div className="divide-y divide-border">
                  {d.unvisited.map((province) => (
                    <div
                      key={province}
                      className="px-3 py-2.5 text-body text-text-primary"
                    >
                      {province}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </SheetLoader>
  )
}
