import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export async function listServings(foodId: string): Promise<Tables<'serving'>[]> {
  const { data, error } = await supabase
    .from('serving')
    .select('*')
    .eq('food_id', foodId)
    .order('grams')
  if (error) throw error
  return data
}

export async function createServing(
  input: TablesInsert<'serving'>,
): Promise<Tables<'serving'>> {
  const { data, error } = await supabase.from('serving').insert(input).select().single()
  if (error) throw error
  return data
}

export async function deleteServing(id: string): Promise<void> {
  const { error } = await supabase.from('serving').delete().eq('id', id)
  if (error) throw error
}

/**
 * Replace a food's serving list (delete all, re-insert) — used when saving a Library edit or the
 * Food Detail Manage-servings editor. Returns the freshly-inserted rows (with their new ids, in
 * input order) so callers can point `food.default_serving_id` at one of them. Note: ids change on
 * every replace, so any reference to a serving id must be re-resolved after calling this.
 */
export async function replaceServings(
  foodId: string,
  rows: { name: string; grams: number }[],
): Promise<Tables<'serving'>[]> {
  const { error: delError } = await supabase
    .from('serving')
    .delete()
    .eq('food_id', foodId)
  if (delError) throw delError
  if (rows.length === 0) return []
  const { data, error } = await supabase
    .from('serving')
    .insert(rows.map((r) => ({ food_id: foodId, name: r.name, grams: r.grams })))
    .select()
  if (error) throw error
  return data
}
