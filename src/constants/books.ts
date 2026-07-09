/**
 * Books domain constants — pure data/UI config only.
 * Types, interfaces, and logic live in `src/lib/books.ts`.
 */

export const BOOK_STATUSES = ['want', 'reading', 'read', 'dropped'] as const

export const BOOK_STATUS_LABELS = {
  want: 'Want',
  reading: 'Reading',
  read: 'Read',
  dropped: 'Dropped',
} as const

/** Status-chip palette (Tailwind classes on the design tokens). */
export const BOOK_STATUS_CHIP = {
  want: 'bg-plan text-bg',
  reading: 'bg-warning text-bg',
  read: 'bg-positive text-bg',
  dropped: 'bg-track text-text-secondary',
} as const

/**
 * The Entry/Edit fields the owner can hide from Books Settings. The core Title / Status / Search
 * controls are always shown and are not listed here. Stored on `profile.book_visible_fields`
 * (NULL = all visible); `'metadata'` covers the read-only Google Books display block.
 */
export const BOOK_VISIBLE_FIELDS: { key: string; label: string }[] = [
  { key: 'authors', label: 'Author(s)' },
  { key: 'year', label: 'Year' },
  { key: 'metadata', label: 'Google Books Metadata' },
  { key: 'rating', label: 'Rating' },
  { key: 'lgbtq_rep', label: 'LGBT+ Representation' },
  { key: 'dynasty', label: 'Dynasty' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'Finish / Drop Date' },
  { key: 'notes', label: 'Notes' },
] as const

export const LGBTQ_REPS = ['none', 'some', 'significant'] as const

export const LGBTQ_REP_LABELS = {
  none: 'None',
  some: 'Some',
  significant: 'Significant',
} as const
