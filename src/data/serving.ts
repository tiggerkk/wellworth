import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import { asNutrientMap, scaledEntry } from '../lib/wellness-nutrients'

export async function listServings(foodId: string): Promise<Tables<'serving'>[]> {
  const { data, error } = await supabase
    .from('serving')
    .select('*')
    .eq('food_id', foodId)
    .order('grams')
  if (error) throw error
  return data
}

/**
 * Every serving for a batch of foods, in one query (used by the Food export — avoids an N+1
 * per-food fetch). Grouped by `food_id`, each group ordered by `grams` ascending (same order as
 * `listServings`).
 */
export async function listServingsForFoods(
  foodIds: string[],
): Promise<Map<string, Tables<'serving'>[]>> {
  const byFood = new Map<string, Tables<'serving'>[]>()
  if (foodIds.length === 0) return byFood
  const { data, error } = await supabase
    .from('serving')
    .select('*')
    .in('food_id', foodIds)
    .order('grams')
  if (error) throw error
  for (const s of data) {
    const group = byFood.get(s.food_id)
    if (group) group.push(s)
    else byFood.set(s.food_id, [s])
  }
  return byFood
}

/**
 * Replace a food's serving list — used when saving a Library edit or the Food Detail
 * Manage-servings editor. Rows carrying an existing `id` are updated in place (preserving that
 * id); rows with no `id` (new servings) are inserted; any previously-stored serving not present
 * in `rows` is deleted. Preserving ids across an edit (rather than delete-all-and-reinsert) keeps
 * `diary_entry.serving_id` valid, which is what lets a gram-size correction be recomputed onto
 * past entries (see `recomputeEntriesForServing`) instead of silently orphaning them.
 * Returns the resulting rows in input order (with ids) so callers can point
 * `food.default_serving_id` at one of them.
 */
export async function replaceServings(
  foodId: string,
  rows: { id?: string; name: string; grams: number }[],
): Promise<Tables<'serving'>[]> {
  const keepIds = rows.filter((r) => r.id).map((r) => r.id!)
  // Delete servings that were removed from the list entirely.
  let delQuery = supabase.from('serving').delete().eq('food_id', foodId)
  delQuery =
    keepIds.length > 0 ? delQuery.not('id', 'in', `(${keepIds.join(',')})`) : delQuery
  const { error: delError } = await delQuery
  if (delError) throw delError

  const toUpdate = rows.filter((r) => r.id)
  const toInsert = rows.filter((r) => !r.id)

  const updated: Tables<'serving'>[] = []
  for (const r of toUpdate) {
    const { data, error } = await supabase
      .from('serving')
      .update({ name: r.name, grams: r.grams })
      .eq('id', r.id!)
      .select()
      .single()
    if (error) throw error
    updated.push(data)
  }

  let inserted: Tables<'serving'>[] = []
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('serving')
      .insert(toInsert.map((r) => ({ food_id: foodId, name: r.name, grams: r.grams })))
      .select()
    if (error) throw error
    inserted = data
  }

  // Re-assemble in the caller's original order.
  const byId = new Map(updated.map((s) => [s.id, s]))
  let insertCursor = 0
  return rows.map((r) => {
    if (r.id) return byId.get(r.id)!
    const next = inserted[insertCursor++]
    if (!next) throw new Error('replaceServings: insert count mismatch')
    return next
  })
}

/**
 * Resolve which saved row is a food's default, either by array index (import/replace flows,
 * which don't track ids) or by matching a row's own id (edit flows, which know exactly which
 * saved row is the default). Callers pass the result straight to
 * `updateFood(foodId, { default_serving_id })`. Shared by `applyImportServings` (data/food.ts)
 * and `writeServings` (Diary Food Detail's Manage Servings) so this resolution step can't drift
 * between the two call sites. (Lives here rather than calling `updateFood` itself, to avoid a
 * circular import — `data/food.ts` already imports from this module.)
 */
export function resolveDefaultServingId(
  saved: Tables<'serving'>[],
  defaultRef: { index: number } | { id: string },
): string | null {
  const defaultRow =
    'id' in defaultRef
      ? saved.find((s) => s.id === defaultRef.id)
      : saved[defaultRef.index]
  return defaultRow?.id ?? null
}

/**
 * Recompute the stored `nutrients`/`energy_kcal` snapshot for every diary_entry that references
 * `servingId`, using that serving's current `grams`. Scoped by an indexed `serving_id` match (not
 * a table scan), so this stays cheap regardless of how many years of history exist — a food is
 * typically logged dozens to low hundreds of times, not more.
 *
 * Only entries with a non-null `serving_id` are touched; entries logged before this fix (or any
 * entry whose serving was later deleted) keep their frozen snapshot, matching the existing
 * historical-accuracy behavior for deleted foods/servings.
 */
export async function recomputeEntriesForServing(
  servingId: string,
  food: { nutrient_basis: string; nutrients: unknown },
  servingGrams: number,
): Promise<void> {
  const { data: entries, error: selError } = await supabase
    .from('diary_entry')
    .select('id, amount')
    .eq('serving_id', servingId)
    .eq('kind', 'food')
  if (selError) throw selError
  if (!entries || entries.length === 0) return

  const perBasis = asNutrientMap(food.nutrients)
  for (const e of entries) {
    const nutrients = scaledEntry(
      perBasis,
      food.nutrient_basis,
      e.amount ?? 1,
      servingGrams,
    )
    const { error: updError } = await supabase
      .from('diary_entry')
      .update({ energy_kcal: nutrients.energy ?? 0, nutrients })
      .eq('id', e.id)
    if (updError) throw updError
  }
}
