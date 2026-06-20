interface ThumbProps {
  /** A fully-resolved image URL, or null for the placeholder tile. */
  url: string | null
  /** Sizing/aspect classes (default a small 2:3 list thumb). */
  className?: string
}

/**
 * Presentational 2:3 rounded image-or-placeholder. The shared core behind `PosterThumb` (Shows,
 * TMDB) and `CoverThumb` (Books, Google Books / Open Library) — neither module duplicates the tile.
 */
export function Thumb({ url, className = 'h-16 w-11' }: ThumbProps) {
  return url ? (
    <img src={url} alt="" className={`shrink-0 rounded object-cover ${className}`} />
  ) : (
    <span className={`shrink-0 rounded bg-input ${className}`} />
  )
}
