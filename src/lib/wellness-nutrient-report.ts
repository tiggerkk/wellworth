import {
  asNutrientMap,
  deriveNetCarbs,
  sumNutrients,
  type NutrientMap,
} from './wellness-nutrients'
import type { DiaryEntrySummary } from '../data/diary-entry'

export interface Aggregate {
  /** Distinct days with at least one entry — the averaging denominator. */
  loggedDays: number
  totals: NutrientMap
  consumedKcal: number
  activityKcal: number
}

/**
 * Aggregate diary entries: summed nutrients (+ derived net carbs), total consumed energy
 * (food, positive) and activity energy (the magnitude of negative activity entries), and
 * the number of distinct logged days. Only reads `day`/`kind`/`energy_kcal`/`nutrients`, so
 * callers can pass either a full `Tables<'diary_entry'>[]` or the lighter
 * `listEntrySummariesByRange` result — see `DiaryEntrySummary`.
 */
export function aggregateEntries(entries: DiaryEntrySummary[]): Aggregate {
  const days = new Set<string>()
  let consumedKcal = 0
  let activityKcal = 0
  const maps: NutrientMap[] = []

  for (const e of entries) {
    days.add(e.day)
    const kcal = e.energy_kcal ?? 0
    if (e.kind === 'activity') activityKcal += Math.abs(kcal)
    else consumedKcal += kcal
    maps.push(asNutrientMap(e.nutrients))
  }

  return {
    loggedDays: days.size,
    totals: deriveNetCarbs(sumNutrients(maps)),
    consumedKcal,
    activityKcal,
  }
}

/** A total divided across the logged days (0 when nothing logged). */
export function perDay(total: number, loggedDays: number): number {
  return loggedDays > 0 ? total / loggedDays : 0
}

/** Per-logged-day average of every nutrient total. */
export function averageNutrients(totals: NutrientMap, loggedDays: number): NutrientMap {
  if (loggedDays <= 0) return {}
  const out: NutrientMap = {}
  for (const [key, value] of Object.entries(totals)) {
    if (value != null) out[key] = value / loggedDays
  }
  return out
}
