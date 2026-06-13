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

/** Replace a food's serving list (delete all, re-insert) — used when saving a Library edit. */
export async function replaceServings(
  foodId: string,
  rows: { name: string; grams: number }[],
): Promise<void> {
  const { error: delError } = await supabase
    .from('serving')
    .delete()
    .eq('food_id', foodId)
  if (delError) throw delError
  if (rows.length === 0) return
  const { error } = await supabase
    .from('serving')
    .insert(rows.map((r) => ({ food_id: foodId, name: r.name, grams: r.grams })))
  if (error) throw error
}
