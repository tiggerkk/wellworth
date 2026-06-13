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
