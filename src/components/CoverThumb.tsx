import { Thumb } from './Thumb'

interface CoverThumbProps {
  /** The book's `cover_url` (already a full image URL), or null for the placeholder. */
  url: string | null
  /** Sizing/aspect classes (default a small 2:3 list thumb). */
  className?: string
}

/** A 2:3 rounded book cover, or a neutral placeholder tile when there's no cover. */
export function CoverThumb({ url, className }: CoverThumbProps) {
  return <Thumb url={url} className={className} />
}
