import { supabase } from '../lib/supabase'
import type { QuoteInsert, QuoteRow, QuoteUpdate } from '../lib/quotes'
import type { QuoteImportPayload } from '../lib/quotes-import'

/**
 * Typed data-access for the `quote` table (one row per quote). Components never call Supabase
 * directly — they go through here. RLS enforces `user_id = auth.uid()` server-side.
 */

/** All of a user's quotes, newest-touched first (Library default order; full sort is M5). */
export async function listQuotes(userId: string): Promise<QuoteRow[]> {
  const { data, error } = await supabase
    .from('quote')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getQuote(id: string): Promise<QuoteRow | null> {
  const { data, error } = await supabase
    .from('quote')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createQuote(input: QuoteInsert): Promise<QuoteRow> {
  const { data, error } = await supabase.from('quote').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateQuote(id: string, patch: QuoteUpdate): Promise<void> {
  const { error } = await supabase.from('quote').update(patch).eq('id', id)
  if (error) throw error
}

/** Hard delete — `quote` is a leaf table with no soft-delete column (Library swipe). */
export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quote').delete().eq('id', id)
  if (error) throw error
}

/**
 * Distinct tags across the user's quotes, sorted — drives the Entry tag autocomplete (and the M5
 * Library tag facet). Quotes data is small, so fetch the `tags` column and dedupe client-side.
 */
export async function listDistinctTags(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('quote')
    .select('tags')
    .eq('user_id', userId)
  if (error) throw error
  const set = new Set<string>()
  for (const row of data ?? []) for (const t of row.tags ?? []) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * Idempotent bulk insert for the CSV importer. `ON CONFLICT (user_id, text_norm) DO NOTHING` (via
 * upsert + ignoreDuplicates) means re-running the same file never duplicates — the unique index on
 * the generated `text_norm` is the arbiter. The screen pre-filters duplicates for the preview; this
 * is the belt-and-braces guard (and `.select()` returns only the truly-inserted rows for the count).
 */
export async function saveImportedQuotes(
  userId: string,
  payloads: QuoteImportPayload[],
): Promise<{ inserted: number }> {
  if (payloads.length === 0) return { inserted: 0 }
  const rows = payloads.map((p) => ({ ...p, user_id: userId }))
  const { data, error } = await supabase
    .from('quote')
    .upsert(rows, { onConflict: 'user_id,text_norm', ignoreDuplicates: true })
    .select('id')
  if (error) throw error
  return { inserted: data?.length ?? 0 }
}
