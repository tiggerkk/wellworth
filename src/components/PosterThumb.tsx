import { posterUrl } from '../lib/shows'
import { Thumb } from './Thumb'

interface PosterThumbProps {
  path: string | null
  /** TMDB size token, e.g. `w92` (lists) or `w185` (detail). */
  size: string
  /** Sizing/aspect classes (default a small 2:3 list thumb). */
  className?: string
}

/** A 2:3 rounded TMDB poster, or a neutral placeholder tile when there's no poster. */
export function PosterThumb({ path, size, className }: PosterThumbProps) {
  return <Thumb url={posterUrl(path, size)} className={className} />
}
