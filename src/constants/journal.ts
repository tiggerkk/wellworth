/**
 * Journal module enums + display labels + seed data (folded into the Quotes module — see
 * `09_quotes_schema.sql`). Pure constants only — runtime helpers live in `src/lib/journal-moods.ts`.
 */
import {
  PALETTE_BLUE,
  PALETTE_CYAN,
  PALETTE_EMERALD,
  PALETTE_GOLD,
  PALETTE_GREY,
  PALETTE_PURPLE,
  PALETTE_RED,
} from './palette'
import { lastNDays, monthsAgo, type RangeOption } from '../lib/date-range'

/**
 * The 7 primary moods, in fixed circumplex display order. Unlike `QUOTE_CATEGORIES`, this set is
 * NOT owner-configurable — it's structural (CHECK-enforced on `journal_entry.mood`, and the
 * Journal Dashboard's circumplex chart is keyed to these 7 positions specifically). The owner can
 * still rename/recolor each mood and edit its sub-tag suggestions (see `JournalMoodConfig` in
 * `src/lib/journal-moods.ts`), but the 7 keys and their order never change.
 */
export const JOURNAL_MOODS = [
  'happy',
  'inspired',
  'calm',
  'neutral',
  'sad',
  'anxious',
  'angry',
] as const
export type JournalMood = (typeof JOURNAL_MOODS)[number]

/** The table default (see `journal_entry.mood` CHECK/DEFAULT in `09_quotes_schema.sql`) — also
 *  the importer's fallback for a blank/unrecognized `mood` cell. */
export const JOURNAL_MOOD_DEFAULT_KEY: JournalMood = 'neutral'

export const JOURNAL_MOOD_LABELS: Record<JournalMood, string> = {
  happy: 'Happy',
  inspired: 'Inspired',
  calm: 'Calm',
  neutral: 'Neutral',
  sad: 'Sad',
  anxious: 'Anxious',
  angry: 'Angry',
}

/** The default swatch for each mood — a rough tone match, not a customization surface itself
 *  (the owner can repick from `PALETTE_SWATCHES` in Journal Moods settings). */
export const JOURNAL_MOOD_DEFAULT_COLORS: Record<JournalMood, string> = {
  happy: PALETTE_GOLD,
  inspired: PALETTE_EMERALD,
  calm: PALETTE_CYAN,
  neutral: PALETTE_GREY,
  sad: PALETTE_BLUE,
  anxious: PALETTE_PURPLE,
  angry: PALETTE_RED,
}

/**
 * Each mood's fixed position on Russell's Circumplex Model of Affect — valence (unpleasant ⇄
 * pleasant) on x, arousal (calm ⇄ activated) on y, both in [-1, 1]. A deliberate simplification:
 * the model plots a continuous emotional state, but Journal only records one of 7 discrete moods
 * per entry, so each mood gets ONE representative point rather than a per-entry coordinate. The
 * Journal Dashboard chart plots one bubble per mood, sized by entry count in the selected
 * interval — see `src/components/JournalCircumplexChart.tsx`.
 */
export const JOURNAL_MOOD_POSITIONS: Record<
  JournalMood,
  { valence: number; arousal: number }
> = {
  happy: { valence: 0.8, arousal: 0.4 },
  inspired: { valence: 0.6, arousal: 0.8 },
  calm: { valence: 0.6, arousal: -0.6 },
  neutral: { valence: 0, arousal: 0 },
  sad: { valence: -0.6, arousal: -0.5 },
  anxious: { valence: -0.4, arousal: 0.7 },
  angry: { valence: -0.8, arousal: 0.5 },
}

/** Seed sub-tag suggestions per mood — hints surfaced next to the Tags field on Journal Entry;
 *  purely a starting point, editable per-mood in Quotes Settings -> Journal Values -> Moods. */
export const JOURNAL_MOOD_DEFAULT_SUB_TAGS: Record<JournalMood, string[]> = {
  happy: ['relieved', 'grateful', 'excited'],
  inspired: ['energetic', 'focused'],
  calm: ['content', 'relaxed', 'peaceful', 'resigned'],
  neutral: ['indifferent'],
  sad: ['lonely', 'hurt', 'disappointed', 'depressed'],
  anxious: ['stressed', 'worried', 'restless'],
  angry: ['frustrated', 'annoyed', 'resentful', 'furious'],
}

/** Journal Dashboard's interval selector — mirrors `WELLNESS_RANGES`' "Last …" dropdown label
 *  style (the same dropdown-menu component), standardized across both modules' Dashboards. */
export const JOURNAL_RANGES: RangeOption[] = [
  { key: '7d', label: 'Last 7 Days', toRange: lastNDays(7) },
  { key: '1m', label: 'Last 1 Month', toRange: monthsAgo(1) },
  { key: '3m', label: 'Last 3 Months', toRange: monthsAgo(3) },
  { key: '6m', label: 'Last 6 Months', toRange: monthsAgo(6) },
  { key: '1y', label: 'Last Year', toRange: monthsAgo(12) },
]

/** Default selected window. Must be one of JOURNAL_RANGES' keys (keep the default here, not in the screen). */
export const JOURNAL_RANGE_DEFAULT = '7d'
