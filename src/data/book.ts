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

  let created = 0
  let updated = 0
  for (const [key, payload] of byKey) {
    const existingId = idByKey.get(key)
    if (existingId) {
      await updateBook(existingId, payload)
      updated += 1
    } else {
      await createBook({ ...payload, user_id: userId })
      created += 1
    }
  }
  return { created, updated }
}
