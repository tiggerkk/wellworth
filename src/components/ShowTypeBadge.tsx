import { IconDeviceTv, IconMovie } from '@tabler/icons-react'
import { SHOW_TYPE_LABELS, type ShowType } from '../lib/shows'

/** Small corner chip distinguishing a TV show from a movie. Icon-only by default. */
export function ShowTypeBadge({ type, size = 14 }: { type: ShowType; size?: number }) {
  const Icon = type === 'tv' ? IconDeviceTv : IconMovie
  return (
    <span
      aria-label={SHOW_TYPE_LABELS[type]}
      title={SHOW_TYPE_LABELS[type]}
      className="inline-flex items-center rounded-md bg-input px-1.5 py-0.5 text-text-secondary"
    >
      <Icon size={size} stroke={1.75} />
    </span>
  )
}
