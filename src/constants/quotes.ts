/**
 * Quotes module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`). Pure constants only — runtime helpers
 * (language detection, category-chip palette, selectors) live in `src/lib/quotes.ts`.
 */

/** The six categories; exactly one is required per quote. */
export const QUOTE_CATEGORIES = [
  'philosophy',
  'heart',
  'connection',
  'growth',
  'wit',
  'observation',
] as const
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number]

export const QUOTE_CATEGORY_LABELS: Record<QuoteCategory, string> = {
  philosophy: 'Philosophy',
  heart: 'Heart',
  connection: 'Connection',
  growth: 'Growth',
  wit: 'Wit',
  observation: 'Observation',
}

/** The medium a quote came from. */
export const QUOTE_SOURCE_TYPES = [
  'tv',
  'movie',
  'book',
  'podcast',
  'article',
  'video',
  'song',
] as const
export type QuoteSourceType = (typeof QUOTE_SOURCE_TYPES)[number]

export const QUOTE_SOURCE_TYPE_LABELS: Record<QuoteSourceType, string> = {
  tv: 'TV Show',
  movie: 'Movie',
  book: 'Book',
  podcast: 'Podcast',
  article: 'Article',
  video: 'Video',
  song: 'Song',
}

/** Language of a quote; auto-detected from the text (CJK -> 'zh'), editable on the form. */
export const QUOTE_LANGUAGES = ['en', 'zh'] as const
export type QuoteLanguage = (typeof QUOTE_LANGUAGES)[number]

export const QUOTE_LANGUAGE_LABELS: Record<QuoteLanguage, string> = {
  en: 'English',
  zh: 'Chinese',
}
