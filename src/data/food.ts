import { supabase } from '../lib/supabase'
import type { ImportFoodRecord } from '../lib/food-import'
import type { ExternalFood } from '../lib/food-api'
import { replaceServings } from './serving'
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

/**
 * A resolved food-import row: the parsed CSV record plus its USDA match (or null = save as custom).
 * `match` present → cache a USDA-backed favorite (per-100g, USDA nutrients); `match` null → a custom
 * food from the CSV's own nutrients/servings.
 */
export interface ImportFoodResolved {
  input: ImportFoodRecord
  match: Pick<ExternalFood, 'externalId' | 'name' | 'nutrients'> | null
}

/**
 * Save the resolved food-import rows for the current user as **favorites** (so USDA foods persist).
 * Idempotent — re-running the same file updates in place, never duplicates: USDA rows dedupe on
 * (source, external_id); custom rows on lower(name) among the user's custom foods. New rows are
 * bulk-inserted (one statement) with their servings linked by position; existing rows are updated
 * (and custom servings replaced). Returns created/updated counts. Mirrors `saveImportedShows`/Books.
 */
export async function saveImportedFoods(
  userId: string,
  items: ImportFoodResolved[],
): Promise<{ created: number; updated: number }> {
  if (items.length === 0) return { created: 0, updated: 0 }

  const existing = await listFoods()
  const usdaByExt = new Map<string, Tables<'food'>>()
  const customByName = new Map<string, Tables<'food'>>()
  for (const f of existing) {
    if (f.source === 'usda' && f.external_id) usdaByExt.set(f.external_id, f)
    else if (f.source === 'custom') customByName.set(f.name.trim().toLowerCase(), f)
  }

  const newRows: TablesInsert<'food'>[] = []
  const newServings: { name: string; grams: number }[][] = [] // parallel to newRows
  let created = 0
  let updated = 0

  for (const it of items) {
    if (it.match) {
      const found = usdaByExt.get(it.match.externalId)
      const fields = {
        name: it.match.name,
        type: it.input.type,
        nutrient_basis: 'per_100g' as const,
        nutrients: it.match.nutrients,
        is_favorite: true,
        deleted_at: null,
      }
      if (found) {
        await updateFood(found.id, fields)
        updated++
      } else {
        newRows.push({
          user_id: userId,
          source: 'usda',
          external_id: it.match.externalId,
          ...fields,
        })
        newServings.push([]) // USDA foods are per-100g; the default 100 g serving is implicit
        created++
      }
    } else {
      const found = customByName.get(it.input.name.trim().toLowerCase())
      if (found) {
        await updateFood(found.id, {
          type: it.input.type,
          nutrient_basis: it.input.nutrient_basis,
          nutrients: it.input.nutrients,
          is_favorite: true,
          deleted_at: null,
        })
        await replaceServings(found.id, it.input.servings)
        updated++
      } else {
        newRows.push({
          user_id: userId,
          source: 'custom',
          external_id: null,
          name: it.input.name,
          type: it.input.type,
          nutrient_basis: it.input.nutrient_basis,
          nutrients: it.input.nutrients,
          is_favorite: true,
        })
        newServings.push(it.input.servings)
        created++
      }
    }
  }

  if (newRows.length > 0) {
    const { data: inserted, error } = await supabase
      .from('food')
      .insert(newRows)
      .select('id')
    if (error) throw error
    const servingRows = (inserted ?? []).flatMap((row, i) =>
      (newServings[i] ?? []).map((s) => ({
        food_id: row.id,
        name: s.name,
        grams: s.grams,
      })),
    )
    if (servingRows.length > 0) {
      const { error: servingError } = await supabase.from('serving').insert(servingRows)
      if (servingError) throw servingError
    }
  }

  return { created, updated }
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

/** Find a previously-cached external food (USDA/OFF) by source + external id, if any. */
export async function getFoodByExternal(
  source: string,
  externalId: string,
): Promise<Tables<'food'> | null> {
  const { data, error } = await supabase
    .from('food')
    .select('*')
    .eq('source', source)
    .eq('external_id', externalId)
    .is('deleted_at', null)
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
