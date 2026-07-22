/**
 * Shows (TV & movies) module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`). Pure constants only — runtime helpers live in `src/lib/shows.ts`.
 */
import type { StatusTone } from './chips'

export const SHOW_TYPES = ['tv', 'movie', 'documentary'] as const
export type ShowType = (typeof SHOW_TYPES)[number]

export const SHOW_TYPE_LABELS: Record<ShowType, string> = {
  tv: 'TV Show',
  movie: 'Movie',
  documentary: 'Documentary',
}

export const SHOW_STATUSES = ['want', 'watching', 'watched', 'dropped'] as const
export type ShowStatus = (typeof SHOW_STATUSES)[number]

export const SHOW_STATUS_LABELS: Record<ShowStatus, string> = {
  want: 'Want',
  watching: 'Watching',
  watched: 'Watched',
  dropped: 'Dropped',
}

export const SHOW_STATUS_CHIP: Record<ShowStatus, StatusTone> = {
  want: 'want',
  watching: 'ongoing',
  watched: 'done',
  dropped: 'dropped',
}
