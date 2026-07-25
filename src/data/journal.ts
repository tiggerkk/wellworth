import { supabase } from '../lib/supabase'
import type { JournalInsert, JournalRow, JournalUpdate } from '../lib/journal'
import type { JournalImportPayload } from '../lib/journal-import'
import type { IsoDate } from '../lib/date'

/**
 * Typed data-access for the `journal_entry` table (one row per calendar day). Components never
 * call Supabase directly — they go through here. RLS enforces `user_id = auth.uid()` server-side.
 */

/** All of a user's journal entries, newest day first (Journal listing default order). */
export async function listJournalEntries(userId: string): Promise<JournalRow[]> {
  const { data, error } = await supabase
    .from('journal_entry')
    .select('*')
    .eq('user_id', userId)
    .order('day', { ascending: false })
  if (error) throw error
  return data
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
