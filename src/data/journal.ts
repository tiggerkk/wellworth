import { supabase } from '../lib/supabase'
import type { JournalInsert, JournalRow, JournalUpdate } from '../lib/journal'
import type { JournalImportPayload } from '../lib/journal-import'
import type { IsoDate } from '../lib/date'

/**
 * Typed data-access for the `journal_entry` table (one row per calendar day). Components never
 * call Supabase directly — they go through here. RLS enforces `user_id = auth.uid()` server-side.
 */

/** Columns the Journal listing renders, searches, filters, or sorts on. `user_id`/`created_at`/
 *  `updated_at` aren't read by `JournalLibrary`/`applyJournalView` (unlike `getJournalEntry*`, which
 *  need the full row) — the only columns worth dropping here, same as `QUOTE_LIST_COLUMNS`. */
const JOURNAL_LIST_COLUMNS = 'id, day, journal_entry, mood, tags'

/** All of a user's journal entries, newest day first (Journal listing default order). */
export async function listJournalEntries(userId: string): Promise<JournalRow[]> {
  const { data, error } = await supabase
    .from('journal_entry')
    .select(JOURNAL_LIST_COLUMNS)
    .eq('user_id', userId)
    .order('day', { ascending: false })
  if (error) throw error
  // Cast: the narrowed select is a subset of journal_entry's columns, and every list-screen
  // consumer only reads fields within JOURNAL_LIST_COLUMNS (see comment above) — so JournalRow is
  // safe here even though user_id/created_at/updated_at are undefined at runtime.
  return data as unknown as JournalRow[]
}

/**
 * Per-mood entry counts within a day range — the Journal Dashboard's circumplex chart source
 * (one bubble per mood, sized by count). Only `mood` is selected: the chart doesn't need entry
 * text/tags, so this stays a narrow, index-covered query (`(user_id, mood)` — see
 * `09_quotes_schema.sql`) independent of `listJournalEntries`.
 */
export async function listJournalMoodCountsByRange(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('journal_entry')
    .select('mood')
    .eq('user_id', userId)
    .gte('day', from)
    .lte('day', to)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.mood] = (counts[row.mood] ?? 0) + 1
  return counts
}

/** Days (within a range) that have a journal entry — drives the Entry screen calendar's cue dots. */
export async function listJournalDays(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<IsoDate[]> {
  const { data, error } = await supabase
    .from('journal_entry')
    .select('day')
    .eq('user_id', userId)
    .gte('day', from)
    .lte('day', to)
  if (error) throw error
  return (data ?? []).map((r) => r.day)
}

export async function getJournalEntry(id: string): Promise<JournalRow | null> {
  const { data, error } = await supabase
    .from('journal_entry')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** The entry for a specific day, if one exists — drives the Entry screen's calendar nav. */
export async function getJournalEntryByDay(
  userId: string,
  day: IsoDate,
): Promise<JournalRow | null> {
  const { data, error } = await supabase
    .from('journal_entry')
    .select('*')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createJournalEntry(input: JournalInsert): Promise<JournalRow> {
  const { data, error } = await supabase
    .from('journal_entry')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateJournalEntry(
  id: string,
  patch: JournalUpdate,
): Promise<void> {
  const { error } = await supabase.from('journal_entry').update(patch).eq('id', id)
  if (error) throw error
}

/** Hard delete — `journal_entry` is a leaf table with no soft-delete column. */
export async function deleteJournalEntry(id: string): Promise<void> {
  const { error } = await supabase.from('journal_entry').delete().eq('id', id)
  if (error) throw error
}

/**
 * Distinct tags across the user's journal entries, sorted — drives the Entry tag autocomplete
 * (and the Library tag facet). Independent of `quote`'s tag vocabulary.
 */
export async function listDistinctJournalTags(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('journal_entry')
    .select('tags')
    .eq('user_id', userId)
  if (error) throw error
  const set = new Set<string>()
  for (const row of data ?? []) for (const t of row.tags ?? []) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * Idempotent-enough bulk insert for the CSV importer. `ON CONFLICT (user_id, day) DO NOTHING` (via
 * upsert + ignoreDuplicates) means re-running the same file never duplicates a day — the unique
 * index on `(user_id, day)` is the arbiter. `.select()` returns only the truly-inserted rows for
 * the count.
 */
export async function saveImportedJournalEntries(
  userId: string,
  payloads: JournalImportPayload[],
): Promise<{ inserted: number }> {
  if (payloads.length === 0) return { inserted: 0 }
  const rows = payloads.map((p) => ({ ...p, user_id: userId }))
  const { data, error } = await supabase
    .from('journal_entry')
    .upsert(rows, { onConflict: 'user_id,day', ignoreDuplicates: true })
    .select('id')
  if (error) throw error
  return { inserted: data?.length ?? 0 }
}
