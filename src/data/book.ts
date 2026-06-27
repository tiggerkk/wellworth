import { supabase } from '../lib/supabase'
import type { BookInsert, BookRow, BookUpdate } from '../lib/books'
import { dedupKey, type ImportBookRow } from '../lib/books-import'

/**
 * Typed data-access for the `book` table (one row per tracked book). Components never call
 * Supabase directly — they go through here. RLS enforces `user_id = auth.uid()` server-side.
 */

/** All of a user's books, newest-touched first (Library default order; full sort is M5). */
export async function listBooks(userId: string): Promise<BookRow[]> {
  const { data, error } = await supabase
    .from('book')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getBook(id: string): Promise<BookRow | null> {
  const { data, error } = await supabase
    .from('book')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createBook(input: BookInsert): Promise<BookRow> {
  const { data, error } = await supabase.from('book').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateBook(id: string, patch: BookUpdate): Promise<void> {
  const { error } = await supabase.from('book').update(patch).eq('id', id)
  if (error) throw error
}

/** Hard delete — `book` has no soft-delete column and nothing references it (Library swipe). */
export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from('book').delete().eq('id', id)
  if (error) throw error
}

/**
 * Idempotent bulk upsert for the CSV importer. Dedups on case-insensitive title + first author
 * against the user's existing rows (and within the batch — last wins): an existing match is
 * **updated**, a new title is **inserted**. Re-running the same file therefore never duplicates.
 */
export async function saveImportedBooks(
  userId: string,
  payloads: ImportBookRow[],
): Promise<{ created: number; updated: number }> {
  // Existing rows keyed by dedupKey → id.
  const { data: existing, error: listError } = await supabase
    .from('book')
    .select('id, title, authors')
    .eq('user_id', userId)
  if (listError) throw listError
  const idByKey = new Map<string, string>()
  for (const b of existing ?? []) idByKey.set(dedupKey(b.title, b.authors?.[0]), b.id)

  // Collapse in-file duplicates (same key) — last wins.
  const byKey = new Map<string, ImportBookRow>()
  for (const p of payloads) byKey.set(dedupKey(p.title, p.authors?.[0]), p)

  // Split into inserts (new) and updates (existing id), then batch each — a single bulk insert + bulk
  // upsert instead of one round-trip per row (was sequential, ~N awaits for N rows). Mirrors
  // `saveImportedShows`; see F16a.
  const newRows: BookInsert[] = []
  const updRows: BookInsert[] = []
  for (const [key, payload] of byKey) {
    const existingId = idByKey.get(key)
    if (existingId) updRows.push({ ...payload, id: existingId, user_id: userId })
    else newRows.push({ ...payload, user_id: userId })
  }

  // Chunk to stay well under request-payload limits (one chunk each for a typical import).
  // `defaultToNull: false` is REQUIRED: `buildImportRow` includes `created_at` only when the CSV has
  // a `start_date` (`want` rows omit it), so batched rows have non-uniform keys. A bulk write unifies
  // keys across the batch and would send the missing `created_at` as NULL — violating its NOT NULL
  // constraint. `false` instead falls back to the column DEFAULT (`now()`), the intended semantics.
  const CHUNK = 500
  for (let i = 0; i < newRows.length; i += CHUNK) {
    const { error } = await supabase
      .from('book')
      .insert(newRows.slice(i, i + CHUNK), { defaultToNull: false })
    if (error) throw error
  }
  for (let i = 0; i < updRows.length; i += CHUNK) {
    // Default onConflict is the primary key (`id`), so each row updates in place.
    const { error } = await supabase
      .from('book')
      .upsert(updRows.slice(i, i + CHUNK), { defaultToNull: false })
    if (error) throw error
  }

  return { created: newRows.length, updated: updRows.length }
}
