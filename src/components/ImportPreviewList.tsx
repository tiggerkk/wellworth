import { type ReactNode } from 'react'

export type ImportRowStatus = 'ok' | 'review' | 'nomatch' | 'manual'

export interface ImportPreviewItem {
  /** Thumbnail (cover/poster) sized `h-14 w-10` — omit for modules with no image (e.g. foods). */
  media?: ReactNode
  title: string
  /** Appended as ` (year)` when set — omit for modules without a year (e.g. foods). */
  year?: number | null
  /** Optional second line (e.g. author(s)); omitted when a module has none. */
  subtitle?: ReactNode
  /** Leading chips/badges on the meta line (status chip, rating, dates, type badge, …). */
  meta?: ReactNode
  status: ImportRowStatus
  /** The CSV row's own title, echoed in the "review …" flag. */
  reviewLabel: string
}

interface ImportPreviewListProps {
  items: ImportPreviewItem[]
  onChange: (index: number) => void
  onManual: (index: number) => void
}

/**
 * Shared preview list for the CSV importers (Books, Shows): a bordered card of result rows, each with
 * a thumbnail, title/subtitle/meta, the No-match/review/manual flag, and Change/Manual actions. The
 * caller renders it inside the sheet's `flex-1 overflow-y-auto` body.
 *
 * **`shrink-0` is load-bearing:** the card's `overflow-hidden` (for rounded corners) resets its flex
 * min-size to 0, so without `shrink-0` flexbox shrinks the whole list to fit the column and clips it —
 * the body never scrolls (the long-list bug Medical's flag-free, overflow-visible list avoided). With
 * `shrink-0` the list keeps its full height, so the body overflows and scrolls as intended.
 */
export function ImportPreviewList({ items, onChange, onManual }: ImportPreviewListProps) {
  return (
    <div className="shrink-0 overflow-hidden rounded-card border border-border bg-surface">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
        >
          {item.media}
          <div className="min-w-0 flex-1">
            <p className="truncate text-body text-text-primary">
              {item.title}
              {item.year ? ` (${item.year})` : ''}
            </p>
            {item.subtitle != null && (
              <p className="truncate text-caption text-text-secondary">{item.subtitle}</p>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
              {item.meta}
              {item.status === 'nomatch' && <span className="text-danger">No match</span>}
              {item.status === 'review' && (
                <span className="text-accent">review “{item.reviewLabel}”</span>
              )}
              {item.status === 'manual' && (
                <span className="text-text-tertiary">manual entry</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => onChange(i)}
              className="rounded-pill bg-danger px-3 py-1 text-caption font-medium text-white"
            >
              Change
            </button>
            <button
              onClick={() => onManual(i)}
              disabled={item.status === 'manual'}
              className="rounded-pill bg-accent px-3 py-1 text-caption font-medium text-white disabled:opacity-40"
            >
              Manual
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
