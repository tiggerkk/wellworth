/**
 * Books module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`). Pure constants only — runtime helpers live in `src/lib/books.ts`.
 */
export const BOOK_STATUSES = ['want', 'reading', 'read', 'dropped'] as const
export type BookStatus = (typeof BOOK_STATUSES)[number]

export const BOOK_STATUS_LABELS = {
  want: 'Want',
  reading: 'Reading',
  read: 'Read',
  dropped: 'Dropped',
} as const

export const BOOK_STATUS_CHIP = {
  want: 'bg-plan text-bg',
  reading: 'bg-warning text-bg',
  read: 'bg-positive text-bg',
  dropped: 'bg-track text-text-secondary',
} as const
