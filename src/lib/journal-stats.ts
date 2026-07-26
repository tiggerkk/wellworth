/**
 * Journal Dashboard KPI derivations — pure, testable. Streaks are calendar-day based (a gap of
 * even one day breaks the streak), counted backwards from `today` regardless of whether today
 * itself has an entry yet (so a streak in progress still shows before today's entry is written).
 */
import { addDays, type IsoDate } from './date'

export interface JournalStats {
  totalEntries: number
  currentStreak: number
  longestStreak: number
  entriesThisMonth: number
}

/** `days` need not be sorted or deduplicated — this normalizes both before computing streaks. */
export function computeJournalStats(days: IsoDate[], today: IsoDate): JournalStats {
  const set = new Set(days)
  const sorted = [...set].sort()

  let currentStreak = 0
  let cursor = set.has(today) ? today : addDays(today, -1)
  while (set.has(cursor)) {
    currentStreak += 1
    cursor = addDays(cursor, -1)
  }

  let longestStreak = 0
  let run = 0
  let prev: IsoDate | null = null
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    prev = day
  }

  const monthKey = today.slice(0, 7)
  const entriesThisMonth = sorted.filter((d) => d.slice(0, 7) === monthKey).length

  return { totalEntries: set.size, currentStreak, longestStreak, entriesThisMonth }
}

/** The mood with the highest count in a `{mood: count}` map — ties broken by the fixed mood
 *  display order (earlier `moodOrder` entry wins), so the result is deterministic. Null when the
 *  map is empty (no entries in the selected interval). */
export function topMood(
  counts: Record<string, number>,
  moodOrder: string[],
): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const key of moodOrder) {
    const count = counts[key] ?? 0
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  return best
}
