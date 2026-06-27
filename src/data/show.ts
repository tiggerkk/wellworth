import { supabase } from '../lib/supabase'
import type { ShowInsert, ShowRow, ShowUpdate } from '../lib/shows'
import { dedupKey, type ImportShowRow } from '../lib/shows-import'

/**
 * Typed data-access for the `show` table (one row per tracked title). Components never call
 * Supabase directly — they go through here. RLS enforces `user_id = auth.uid()` server-side.
 */

/** All of a user's shows, newest-touched first (Library default order; full sort is M5). */
export async function listShows(userId: string): Promise<ShowRow[]> {
  const { data, error } = await supabase
    .from('show')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getShow(id: string): Promise<ShowRow | null> {
  const { data, error } = await supabase
    .from('show')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createShow(input: ShowInsert): Promise<ShowRow> {
  const { data, error } = await supabase.from('show').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateShow(id: string, patch: ShowUpdate): Promise<void> {
  const { error } = await supabase.from('show').update(patch).eq('id', id)
  if (error) throw error
}

/** Hard delete — `show` has no soft-delete column and nothing references it (Library swipe). */
export async function deleteShow(id: string): Promise<void> {
  const { error } = await supabase.from('show').delete().eq('id', id)
  if (error) throw error
}

/**
 * Idempotent bulk upsert for the CSV importer. Dedups on case-insensitive title against the
 * user's existing rows (and within the batch — last wins): an existing match is **updated**, a
 * new title is **inserted**. Re-running the same file therefore never duplicates.
 */
export async function saveImportedShows(
  userId: string,
  payloads: ImportShowRow[],
): Promise<{ created: number; updated: number }> {
  // Existing rows keyed by dedupKey → id.
  const { data: existing, error: listError } = await supabase
    .from('show')
    .select('id, title')
    .eq('user_id', userId)
  if (listError) throw listError
  const idByKey = new Map<string, string>()
  for (const s of existing ?? []) idByKey.set(dedupKey(s.title), s.id)

  // Collapse in-file duplicates (same key) — last wins.
  const byKey = new Map<string, ImportShowRow>()
  for (const p of payloads) byKey.set(dedupKey(p.title), p)

  // Split into inserts (new titles) and updates (existing id), then batch each — a single bulk
  // insert + bulk upsert instead of one round-trip per row (was sequential, ~N awaits for N rows).
  const newRows: ShowInsert[] = []
  const updRows: ShowInsert[] = []
  for (const [key, payload] of byKey) {
    const existingId = idByKey.get(key)
    if (existingId) updRows.push({ ...payload, id: existingId, user_id: userId })
    else newRows.push({ ...payload, user_id: userId })
  }

  // Chunk to stay well under request-payload limits (one chunk each for a typical import).
  // `defaultToNull: false` is REQUIRED: rows vary in keys (`created_at` is present only when the
  // CSV has a `start_date`; `want` rows omit it). A bulk write unifies keys across the batch, and
  // the default behaviour would send the missing `created_at` as NULL — violating its NOT NULL
  // constraint. `false` instead falls back to the column DEFAULT (`now()`), the intended semantics.
  const CHUNK = 500
  for (let i = 0; i < newRows.length; i += CHUNK) {
    const { error } = await supabase
      .from('show')
      .insert(newRows.slice(i, i + CHUNK), { defaultToNull: false })
    if (error) throw error
  }
  for (let i = 0; i < updRows.length; i += CHUNK) {
    // Default onConflict is the primary key (`id`), so each row updates in place.
    const { error } = await supabase
      .from('show')
      .upsert(updRows.slice(i, i + CHUNK), { defaultToNull: false })
    if (error) throw error
  }

  return { created: newRows.length, updated: updRows.length }
}
