/**
 * Journal Moods — resolve, rename, recolor, and re-suggest sub-tags for the 7 fixed moods stored
 * on `profile.journal_moods`. Deliberately NOT modeled on `quotes-config.ts`'s add/remove/reorder
 * shape: the mood set is structural (see `JOURNAL_MOODS`), so only `label`, `color`, and `subTags`
 * are ever owner-editable, and always for exactly the 7 canonical keys, in their fixed order.
 */
import {
  JOURNAL_MOOD_DEFAULT_COLORS,
  JOURNAL_MOOD_DEFAULT_SUB_TAGS,
  JOURNAL_MOOD_LABELS,
  JOURNAL_MOODS,
  type JournalMood,
} from '../constants/journal'

export interface JournalMoodConfig {
  key: JournalMood
  label: string
  color: string
  subTags: string[]
}

/** The canonical mood defaults (seed + NULL fallback), in their fixed circumplex display order. */
export function defaultMoods(): JournalMoodConfig[] {
  return JOURNAL_MOODS.map((key) => ({
    key,
    label: JOURNAL_MOOD_LABELS[key],
    color: JOURNAL_MOOD_DEFAULT_COLORS[key],
    subTags: JOURNAL_MOOD_DEFAULT_SUB_TAGS[key],
  }))
}

function isJournalMood(key: string): key is JournalMood {
  return (JOURNAL_MOODS as readonly string[]).includes(key)
}

function readEntry(v: unknown, key: JournalMood): JournalMoodConfig {
  const fallback = {
    key,
    label: JOURNAL_MOOD_LABELS[key],
    color: JOURNAL_MOOD_DEFAULT_COLORS[key],
    subTags: JOURNAL_MOOD_DEFAULT_SUB_TAGS[key],
  }
  if (typeof v !== 'object' || v === null) return fallback
  const o = v as Record<string, unknown>
  const label =
    typeof o.label === 'string' && o.label.trim() ? o.label.trim() : fallback.label
  const color =
    typeof o.color === 'string' && o.color.trim() ? o.color.trim() : fallback.color
  const subTags = Array.isArray(o.subTags)
    ? o.subTags.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    : fallback.subTags
  return { key, label, color, subTags }
}

/**
 * Resolve the owner's mood list (override JSONB) -> exactly 7 validated configs, one per
 * canonical key, in fixed order. Unlike `effectiveCategories`, a partial or empty override is
 * tolerated per-key (each of the 7 keys independently falls back to its own default) rather than
 * discarding the whole override — there's no "customized vs not" distinction to preserve, since
 * every owner always has all 7 moods.
 */
export function effectiveMoods(override: unknown): JournalMoodConfig[] {
  const byKey = new Map<string, unknown>()
  if (Array.isArray(override)) {
    for (const raw of override) {
      if (typeof raw === 'object' && raw !== null) {
        const k = (raw as Record<string, unknown>).key
        if (typeof k === 'string' && isJournalMood(k)) byKey.set(k, raw)
      }
    }
  }
  return JOURNAL_MOODS.map((key) => readEntry(byKey.get(key), key))
}

export function moodLabel(list: JournalMoodConfig[], key: string): string {
  return list.find((e) => e.key === key)?.label ?? key
}

/** The stable display colour for a mood key — falls back to the canonical default for an orphan
 *  (shouldn't happen given the fixed key set, but mirrors `categoryColor`'s tolerance). */
export function moodColor(list: JournalMoodConfig[], key: string): string {
  const found = list.find((e) => e.key === key)
  if (found) return found.color
  return isJournalMood(key)
    ? JOURNAL_MOOD_DEFAULT_COLORS[key]
    : 'var(--color-text-secondary)'
}

export function moodSubTags(list: JournalMoodConfig[], key: string): string[] {
  const found = list.find((e) => e.key === key)
  if (found) return found.subTags
  return isJournalMood(key) ? JOURNAL_MOOD_DEFAULT_SUB_TAGS[key] : []
}

export function renameMood(
  list: JournalMoodConfig[],
  key: string,
  label: string,
): JournalMoodConfig[] {
  const trimmed = label.trim()
  if (!trimmed) return list
  return list.map((e) => (e.key === key ? { ...e, label: trimmed } : e))
}

export function recolorMood(
  list: JournalMoodConfig[],
  key: string,
  color: string,
): JournalMoodConfig[] {
  return list.map((e) => (e.key === key ? { ...e, color } : e))
}

export function resubTagMood(
  list: JournalMoodConfig[],
  key: string,
  subTags: string[],
): JournalMoodConfig[] {
  return list.map((e) => (e.key === key ? { ...e, subTags } : e))
}

/** Match a free-text CSV cell to a mood key by key OR label, case-insensitive. Returns null (not
 *  a default) for the importer to decide the fallback — see `journal-import.ts`. */
export function matchMoodKeyOrLabel(
  list: JournalMoodConfig[],
  raw: string,
): JournalMood | null {
  const norm = raw.trim().toLowerCase()
  if (!norm) return null
  const byKey = list.find((e) => e.key.toLowerCase() === norm)?.key
  if (byKey && isJournalMood(byKey)) return byKey
  const byLabel = list.find((e) => e.label.toLowerCase() === norm)?.key
  if (byLabel && isJournalMood(byLabel)) return byLabel
  return null
}
