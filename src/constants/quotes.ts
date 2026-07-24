/**
 * Quotes module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`). Pure constants only — runtime helpers
 * live in `src/lib/quotes.ts`.
 */
import {
  PALETTE_BLUE,
  PALETTE_BROWN,
  PALETTE_CYAN,
  PALETTE_EMERALD,
  PALETTE_GOLD,
  PALETTE_GREY,
  PALETTE_MAGENTA,
  PALETTE_PURPLE,
  PALETTE_RED,
  PALETTE_OFF_WHITE,
} from './palette'

/**
 * The default categories + their initial display order. Exactly one category is required per quote.
 * These are only the **seed defaults**: the owner can add/rename/delete/reorder them in Quotes
 * Settings (stored on `profile.quote_categories`). The literal-union type describes the defaults' shape;
 * stored values are plain `string` keys (see `src/lib/quotes-config.ts`).
 */
export const QUOTE_CATEGORIES = [
  'wit',
  'observation',
  'philosophy',
  'love',
  'relationship',
  'growth',
] as const
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number]

export const QUOTE_CATEGORY_LABELS: Record<QuoteCategory, string> = {
  wit: 'Wit',
  observation: 'Observation',
  philosophy: 'Philosophy',
  love: 'Love',
  relationship: 'Relationship',
  growth: 'Growth',
}

/**
 * The swatch palette for **category colours** — the choices offered by the per-row colour picker in
 * Quotes Settings → Categories, and the default-assignment cycle for seed / new categories
 * (`src/lib/quotes-config.ts`). Values are design tokens (CSS vars) so they track the theme. The
 * category's chosen colour is stored per entry on `profile.quote_categories` and drives the left-strip
 * accent on each row in the Quotes Library.
 */
export const QUOTE_CATEGORY_COLORS = [
  { name: 'Emerald', value: PALETTE_EMERALD },
  { name: 'Blue', value: PALETTE_BLUE },
  { name: 'Purple', value: PALETTE_PURPLE },
  { name: 'Red', value: PALETTE_RED },
  { name: 'Gold', value: PALETTE_GOLD },
  { name: 'Grey', value: PALETTE_GREY },
  { name: 'Brown', value: PALETTE_BROWN },
  { name: 'Cyan', value: PALETTE_CYAN },
  { name: 'Magenta', value: PALETTE_MAGENTA },
  { name: 'Off-White', value: PALETTE_OFF_WHITE },
] as const

/** Neutral fallback for an orphan/unconfigured category colour (e.g. a deleted category still on a row). */
export const QUOTE_CATEGORY_COLOR_FALLBACK = 'var(--color-text-secondary)'

/** The default source types (the medium a quote came from) + their initial display order (seed defaults). */
export const QUOTE_SOURCE_TYPES = [
  'book',
  'podcast',
  'tv',
  'movie',
  'interview',
  'article',
  'song',
  'video',
] as const
export type QuoteSourceType = (typeof QUOTE_SOURCE_TYPES)[number]

export const QUOTE_SOURCE_TYPE_LABELS: Record<QuoteSourceType, string> = {
  book: 'Book',
  podcast: 'Podcast',
  tv: 'TV Show',
  movie: 'Movie',
  interview: 'Interview',
  article: 'Article',
  song: 'Song',
  video: 'Video',
}

/** Language of a quote; auto-detected from the text (CJK -> 'zh'), editable on the form. */
export const QUOTE_LANGUAGES = ['en', 'zh'] as const
export type QuoteLanguage = (typeof QUOTE_LANGUAGES)[number]

export const QUOTE_LANGUAGE_LABELS: Record<QuoteLanguage, string> = {
  en: 'English',
  zh: 'Chinese',
}
