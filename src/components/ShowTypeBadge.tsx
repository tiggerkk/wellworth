import { IconDeviceTv, IconMovie, IconVideo } from '@tabler/icons-react'
import { SHOW_TYPE_LABELS, type ShowType } from '../constants/shows'

const TYPE_ICON = { tv: IconDeviceTv, movie: IconMovie, documentary: IconVideo } as const

/** Small corner chip distinguishing a TV show / movie / documentary. Icon-only by default. */
export function ShowTypeBadge({ type, size = 14 }: { type: ShowType; size?: number }) {
  const Icon = TYPE_ICON[type]
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
