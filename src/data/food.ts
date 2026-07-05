import { supabase } from '../lib/supabase'
import type { ImportFoodRecord } from '../lib/food-import'
import type { ExternalFood } from '../lib/food-api'
import { replaceServings } from './serving'
import { foodHasEntries } from './diary-entry'
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
 * food from the CSV's own nutrients/servings. We carry the match's `servingText`/`servingGrams` so an
 * imported USDA food keeps its household serving (Food Detail reads the cached row, not the API).
 */
export interface ImportFoodResolved {
  input: ImportFoodRecord
  match: Pick<
    ExternalFood,
    'externalId' | 'name' | 'nutrients' | 'servingText' | 'servingGrams'
  > | null
}

/**
 * The serving rows a resolved import row should get + the index of its default. A USDA match's own
 * household serving (when it has grams) goes first, then the CSV's custom servings. Default priority:
 * the CSV `default_serving` (by name) → the USDA serving → the first serving.
 */
function importServings(it: ImportFoodResolved): {
  rows: { name: string; grams: number }[]
  defaultIndex: number
} {
  const rows: { name: string; grams: number }[] = []
  if (it.match?.servingGrams) {
    rows.push({ name: it.match.servingText || '1 serving', grams: it.match.servingGrams })
  }
  rows.push(...it.input.servings)
  const wanted = it.input.default_serving_name
  let defaultIndex = wanted ? rows.findIndex((r) => r.name === wanted) : -1
  if (defaultIndex < 0 && rows.length > 0) defaultIndex = 0
  return { rows, defaultIndex }
}

/** Replace an existing food's servings from an import plan and point its default at the right row. */
async function applyImportServings(
  foodId: string,
  plan: { rows: { name: string; grams: number }[]; defaultIndex: number },
): Promise<void> {
  const saved = await replaceServings(foodId, plan.rows)
  await updateFood(foodId, {
    default_serving_id:
      plan.defaultIndex >= 0 ? (saved[plan.defaultIndex]?.id ?? null) : null,
  })
}

/**
 * Save the resolved food-import rows for the current user as **favorites** (so USDA foods persist).
 * Idempotent — re-running the same file updates in place, never duplicates: USDA rows dedupe on
 * (source, external_id); custom rows on lower(name) among the user's custom foods. New rows are
 * bulk-inserted (one statement) with their servings linked by position; existing rows are updated
 * (and custom servings replaced). Returns created/updated counts.
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
  const newPlans: ReturnType<typeof importServings>[] = [] // parallel to newRows
  let created = 0
  let updated = 0

  for (const it of items) {
    const plan = importServings(it)
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
        await applyImportServings(found.id, plan) // re-import overwrites servings + default
        updated++
      } else {
        newRows.push({
          user_id: userId,
          source: 'usda',
          external_id: it.match.externalId,
          ...fields,
        })
        newPlans.push(plan)
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
        await applyImportServings(found.id, plan)
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
        newPlans.push(plan)
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
    const ids = (inserted ?? []).map((r) => r.id)

    // Bulk-insert the servings (linked to the new foods by position), keeping the inserted rows so
    // we can resolve each food's default by position.
    const servingRows = ids.flatMap((id, i) =>
      newPlans[i]!.rows.map((s) => ({ food_id: id, name: s.name, grams: s.grams })),
    )
    if (servingRows.length > 0) {
      const { data: savedServings, error: servingError } = await supabase
        .from('serving')
        .insert(servingRows)
        .select()
      if (servingError) throw servingError

      // Walk the inserted servings in the same flattened order to find each food's default id, then
      // write default_serving_id in ONE bulk upsert (re-sending the full new rows so NOT NULL columns
      // are satisfied — a partial upsert would null user_id/source/name on the INSERT attempt).
      const saved = savedServings ?? []
      const defaultById = new Map<string, string>()
      let offset = 0
      ids.forEach((id, i) => {
        const plan = newPlans[i]!
        if (plan.defaultIndex >= 0) {
          const srv = saved[offset + plan.defaultIndex]
          if (srv) defaultById.set(id, srv.id)
        }
        offset += plan.rows.length
      })
      if (defaultById.size > 0) {
        const upsertRows = ids.map((id, i) => ({
          ...newRows[i]!,
          id,
          default_serving_id: defaultById.get(id) ?? null,
        }))
        const { error: upErr } = await supabase
          .from('food')
          .upsert(upsertRows, { onConflict: 'id' })
        if (upErr) throw upErr
      }
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

/** Hard delete a food and its servings (cascade). Only safe when nothing references it. */
async function hardDeleteFood(id: string): Promise<void> {
  const { error } = await supabase.from('food').delete().eq('id', id)
  if (error) throw error
}

/**
 * Delete a food the right way: if any diary entry still references it, **soft-delete** so the
 * entry's snapshot + FK survive (the spec forbids hard-deleting a referenced food); otherwise
 * **hard-delete** so an unreferenced "phantom" (a cached USDA/OFF row from a favorite/log, or an
 * unused custom food) leaves no tombstone behind. Its `serving` rows cascade on hard delete.
 */
export async function deleteFoodSmart(id: string): Promise<void> {
  if (await foodHasEntries(id)) {
    await softDeleteFood(id)
  } else {
    await hardDeleteFood(id)
  }
}
