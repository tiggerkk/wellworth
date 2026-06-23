/**
 * Quotes module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`). Pure constants only — runtime helpers
 * (language detection, category-chip palette, selectors) live in `src/lib/quotes.ts`.
 */

/**
 * The default categories + their initial display order. Exactly one category is required per quote.
 * Since M8 these are only the **seed defaults**: the owner can add/rename/delete/reorder them in Quotes
 * Settings (stored on `profile.quote_categories`). The literal-union type describes the defaults' shape;
 * stored values are plain `string` keys (see `src/lib/quotes-config.ts`).
 */
export const QUOTE_CATEGORIES = [
  'wit',
  'observation',
  'philosophy',
  'heart',
  'connection',
  'growth',
] as const
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number]

export const QUOTE_CATEGORY_LABELS: Record<QuoteCategory, string> = {
  wit: 'Wit',
  observation: 'Observation',
  philosophy: 'Philosophy',
  heart: 'Heart',
  connection: 'Connection',
  growth: 'Growth',
}

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
