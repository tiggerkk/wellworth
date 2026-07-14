import { useProfile } from '../hooks/useProfile'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { aggregateEntries, averageNutrients, perDay } from '../lib/medical-report'
import { computeTargets } from '../lib/wellness-targets'
import { isOverUpperLimit } from '../lib/wellness-nutrients'
import { NUTRIENT_SECTIONS } from '../constants/wellness'
import { EnergyBalanceCard } from './EnergyBalanceCard'
import { NutrientBar } from './NutrientBar'
import type { Tables } from '../types/database'

interface NutrientReportProps {
  entries: Tables<'diary_entry'>[] | undefined
  loading: boolean
  error: Error | undefined
}

/**
 * Shared report body for the Dashboard (range) and Daily Report (single day). Values are
 * per-logged-day averages, so a single day shows that day's totals. Renders the Energy
 * Balance card and the visible-nutrient sections in the fixed order, red over total-intake ULs.
 */
export function NutrientReport({ entries, loading, error }: NutrientReportProps) {
  const { data: profile } = useProfile()
  const { byKey, nutrients } = useNutrientReference()

  if (loading) return <p className="px-4 py-6 text-body text-text-secondary">Loading…</p>
  if (error)
    return <p className="px-4 py-6 text-body text-danger">Couldn’t load this report.</p>

  const agg = aggregateEntries(entries ?? [])
  if (agg.loggedDays === 0) {
    return (
      <p className="px-4 py-6 text-body text-text-tertiary">
        Nothing logged in this range.
      </p>
    )
  }

  const avg = averageNutrients(agg.totals, agg.loggedDays)
  const targets = profile ? computeTargets(profile) : null
  const visible = new Set(profile?.visible_nutrients ?? [])

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <EnergyBalanceCard
        consumed={perDay(agg.consumedKcal, agg.loggedDays)}
        bmr={targets?.bmr ?? 0}
        activity={perDay(agg.activityKcal, agg.loggedDays)}
      />

      {NUTRIENT_SECTIONS.map((section) => {
        const rows = (nutrients ?? []).filter(
          (n) => n.category === section.category && visible.has(n.key),
        )
        if (rows.length === 0) return null
        return (
          <div key={section.category}>
            <h2 className="mb-1 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
              {section.label}
            </h2>
            <div className="rounded-card border border-border bg-surface px-4 py-1">
              {rows.map((n) => {
                const dri = targets?.dri[n.key]
                const value = avg[n.key] ?? 0
                const ref = byKey.get(n.key)
                return (
                  <div key={n.key} className={n.parent_key ? 'pl-3' : ''}>
                    <NutrientBar
                      label={ref?.display_name ?? n.key}
                      value={value}
                      target={dri?.target ?? null}
                      unit={n.unit}
                      over={dri ? isOverUpperLimit(value, dri) : false}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
