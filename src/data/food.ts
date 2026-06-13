import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

export interface ListFoodsOptions {
  favoritesOnly?: boolean
  type?: 'food' | 'supplement'
}

/** Active (not soft-deleted) foods for the current user, newest first. */
export async function listFoods(
  options: ListFoodsOptions = {},
): Promise<Tables<'food'>[]> {
  let query = supabase
    .from('food')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (options.favoritesOnly) query = query.eq('is_favorite', true)
  if (options.type) query = query.eq('type', options.type)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getFood(id: string): Promise<Tables<'food'> | null> {
  const { data, error } = await supabase
    .from('food')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createFood(input: TablesInsert<'food'>): Promise<Tables<'food'>> {
  const { data, error } = await supabase.from('food').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateFood(
  id: string,
  patch: TablesUpdate<'food'>,
): Promise<Tables<'food'>> {
  const { data, error } = await supabase
    .from('food')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from('food')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
  if (error) throw error
}

/** Soft delete — diary entries keep their snapshot; the item leaves Library/Add lists. */
export async function softDeleteFood(id: string): Promise<void> {
  const { error } = await supabase
    .from('food')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
