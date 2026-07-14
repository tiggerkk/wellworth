import { supabase } from '../lib/supabase'
import type { QuoteInsert, QuoteRow, QuoteUpdate } from '../lib/quotes'
import type { QuoteImportPayload } from '../lib/quotes-import'

/**
 * Typed data-access for the `quote` table (one row per quote). Components never call Supabase
 * directly — they go through here. RLS enforces `user_id = auth.uid()` server-side.
 */

/**
 * Columns the list screens need: Library row rendering + search (`quoteSearchText`: text/author/
 * title/tags), filter/sort (`applyLibraryView`: category/tags/favorite/linkedOnly/sourceType/
 * language/showId/bookId/date), and Zen (source link via show_id/book_id, favourite toggle).
 * Deliberately omits `text_norm` — it's a generated, lower+trimmed duplicate of `text` that only
 * backs the server-side UNIQUE constraint and import idempotency; no screen reads it (the
 * importer recomputes its own normalized text from `text` client-side). Mirrors the same trim in
 * `data/show.ts` / `data/book.ts`; since `quote` has no unused free-text columns the way
 * show/book did (overview/notes), this is the only column worth dropping here.
 */
const QUOTE_LIST_COLUMNS =
  'id, user_id, text, author, source_type, title, category, tags, language, is_favorite, ' +
  'show_id, book_id, created_at, updated_at'

/** All of a user's quotes, newest-touched first (Library default order; full sort is M5). */
export async function listQuotes(userId: string): Promise<QuoteRow[]> {
  const { data, error } = await supabase
    .from('quote')
    .select(QUOTE_LIST_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  // Cast: the narrowed select is a subset of `quote`'s columns, and every list-screen consumer
  // only reads fields within QUOTE_LIST_COLUMNS (see comment above) — so QuoteRow is safe here
  // even though `text_norm` is `undefined` at runtime.
  return data as unknown as QuoteRow[]
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

/** A field whose value is a configurable Source Type / Category key (see `src/lib/quotes-config.ts`). */
export type ConfigurableQuoteField = 'source_type' | 'category'

/** How many of the user's quotes use a given source-type / category key — gates a value's deletion. */
export async function countQuotesByField(
  userId: string,
  field: ConfigurableQuoteField,
  key: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('quote')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq(field, key)
  if (error) throw error
  return count ?? 0
}

/**
 * Reassign every quote using `fromKey` to `toKey` for the given field — the migration step when the
 * owner deletes an in-use Source Type / Category. `field` is a fixed union (no injection surface).
 */
export async function reassignQuoteField(
  userId: string,
  field: ConfigurableQuoteField,
  fromKey: string,
  toKey: string,
): Promise<void> {
  const { error } = await supabase
    .from('quote')
    .update({ [field]: toKey } as QuoteUpdate)
    .eq('user_id', userId)
    .eq(field, fromKey)
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
