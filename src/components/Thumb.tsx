import { useState } from 'react'

interface ThumbProps {
  /** A fully-resolved image URL, or null for the placeholder tile. */
  url: string | null
  /** Sizing/aspect classes (default a small 2:3 list thumb). */
  className?: string
}

/**
 * Presentational 2:3 rounded image-or-placeholder. The shared core behind `PosterThumb` (Shows,
 * TMDB) and `CoverThumb` (Books, Google Books / Open Library) — neither module duplicates the tile.
 * `referrerpolicy="no-referrer"` so hotlink-protected CDNs (e.g. a pasted Douban poster) still serve.
 * `loading="lazy"` so off-screen rows (Library lists, growing over time) don't fetch their poster
 * until they're about to scroll into view — otherwise every row's image starts downloading on
 * mount regardless of visibility. Falls back to the placeholder tile if the URL fails to load
 * (broken link, 404, etc.) so the slot keeps its fixed size instead of collapsing to the browser's
 * broken-image icon.
 */
export function Thumb({ url, className }: ThumbProps) {
  const [failed, setFailed] = useState(false)
  const sizeClasses = className ?? 'h-16 w-11'

  return url && !failed ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded object-cover ${sizeClasses}`}
    />
  ) : (
    <span className={`inline-block shrink-0 rounded bg-input ${sizeClasses}`} />
  )
}
