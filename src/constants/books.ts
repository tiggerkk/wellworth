/**
 * Books module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`). Pure constants only — runtime helpers live in `src/lib/books.ts`.
 */
export const BOOK_STATUSES = ['want', 'reading', 'read', 'dropped'] as const
export type BookStatus = (typeof BOOK_STATUSES)[number]

import type { StatusTone } from './chips'

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  want: 'Want',
  reading: 'Reading',
  read: 'Read',
  dropped: 'Dropped',
}

export const BOOK_STATUS_CHIP: Record<BookStatus, StatusTone> = {
  want: 'want',
  reading: 'ongoing',
  read: 'done',
  dropped: 'dropped',
}
