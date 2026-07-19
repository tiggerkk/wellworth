/**
 * Filter/sort helpers for the Wellness Library's Foods and Activities tabs — UI-framework-free so
 * criteria live as plain state in `WellnessLibrary` and the view is a pure function of it.
 */
import type { Tables } from '../types/database'
import { foldZh } from './zh-fold'

export type FoodRow = Tables<'food'>
export type ActivityRow = Tables<'activity'>

// --- Foods -----------------------------------------------------------------------------------

export type FoodSortField = 'name' | 'type' | 'source'

export interface FoodListCriteria {
  query: string
  type: 'all' | string
  source: 'all' | string
  favoritesOnly: boolean
  sortField: FoodSortField
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_FOOD_CRITERIA: FoodListCriteria = {
  query: '',
  type: 'all',
  source: 'all',
  favoritesOnly: false,
  sortField: 'name',
  sortDir: 'asc',
}

export function applyFoodListView(foods: FoodRow[], c: FoodListCriteria): FoodRow[] {
  const q = foldZh(c.query.trim())
  const filtered = foods.filter((f) => {
    if (q && !foldZh(f.name).includes(q)) return false
    if (c.type !== 'all' && f.type !== c.type) return false
    if (c.source !== 'all' && f.source !== c.source) return false
    if (c.favoritesOnly && !f.is_favorite) return false
    return true
  })
  const dir = c.sortDir === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const primary =
      c.sortField === 'type'
        ? a.type.localeCompare(b.type)
        : c.sortField === 'source'
          ? a.source.localeCompare(b.source)
          : 0
    return primary !== 0 ? dir * primary : dir * a.name.localeCompare(b.name)
  })
}

// --- Activities --------------------------------------------------------------------------------

export type ActivitySortField = 'name' | 'template' | 'effort'

export interface ActivityListCriteria {
  query: string
  template: 'all' | string
  effort: 'all' | string
  sortField: ActivitySortField
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_ACTIVITY_CRITERIA: ActivityListCriteria = {
  query: '',
  template: 'all',
  effort: 'all',
  sortField: 'name',
  sortDir: 'asc',
}

export function applyActivityListView(
  activities: ActivityRow[],
  c: ActivityListCriteria,
): ActivityRow[] {
  const q = foldZh(c.query.trim())
  const filtered = activities.filter((a) => {
    if (q && !foldZh(a.name).includes(q)) return false
    if (c.template !== 'all' && a.template !== c.template) return false
    if (c.effort !== 'all' && a.default_effort !== c.effort) return false
    return true
  })
  const dir = c.sortDir === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const primary =
      c.sortField === 'template'
        ? a.template.localeCompare(b.template)
        : c.sortField === 'effort'
          ? a.default_effort.localeCompare(b.default_effort)
          : 0
    return primary !== 0 ? dir * primary : dir * a.name.localeCompare(b.name)
  })
}
