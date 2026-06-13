import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'

/** All nutrient reference rows, ordered for display (Dashboard/Settings group + order). */
export async function getAllNutrients(): Promise<Tables<'nutrient'>[]> {
  const { data, error } = await supabase
    .from('nutrient')
    .select('*')
    .order('category')
    .order('sort_order')

  if (error) throw error
  return data
}

/** Keys of nutrients flagged default_visible in the reference table — the Phase-1
 * visible set. Used to seed a new profile's visible_nutrients (single source of truth,
 * rather than hardcoding the list). */
export async function getDefaultVisibleNutrientKeys(): Promise<string[]> {
  const { data, error } = await supabase
    .from('nutrient')
    .select('key')
    .eq('default_visible', true)
    .order('sort_order')

  if (error) throw error
  return data.map((row) => row.key)
}
