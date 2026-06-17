import { posterUrl } from '../lib/shows'

interface PosterThumbProps {
  path: string | null
  /** TMDB size token, e.g. `w92` (lists) or `w185` (detail). */
  size: string
  /** Sizing/aspect classes (default a small 2:3 list thumb). */
  className?: string
}

/** A 2:3 rounded TMDB poster, or a neutral placeholder tile when there's no poster. */
export function PosterThumb({ path, size, className = 'h-16 w-11' }: PosterThumbProps) {
  const url = posterUrl(path, size)
  return url ? (
    <img src={url} alt="" className={`shrink-0 rounded object-cover ${className}`} />
  ) : (
    <span className={`shrink-0 rounded bg-input ${className}`} />
  )
}
