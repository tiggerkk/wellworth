import { supabase } from '../lib/supabase'

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
