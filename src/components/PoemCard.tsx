import { IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { DYNASTY_CHIP, type PoemIndexEntry } from '../lib/literature'

interface PoemCardProps {
  entry: PoemIndexEntry
  isFavorite: boolean
  onOpen: () => void
  onToggleFavorite: () => void
}

/** A poem-list card (Home + Favorites): title · writer · dynasty badge · excerpt, with a heart. */
export function PoemCard({ entry, isFavorite, onOpen, onToggleFavorite }: PoemCardProps) {
  return (
    <div className="flex items-start rounded-card border border-border bg-surface">
      <button onClick={onOpen} className="min-w-0 flex-1 px-3 py-3 text-left">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-body font-medium text-text-primary">{entry.title}</span>
          <span className="text-caption text-text-secondary">{entry.writer}</span>
          {entry.dynasty && (
            <span className={`rounded-pill px-1.5 py-0.5 text-section ${DYNASTY_CHIP}`}>
              {entry.dynasty}
            </span>
          )}
        </span>
        <p className="mt-1 line-clamp-1 text-caption text-text-secondary">
          {entry.excerpt}
        </p>
      </button>
      <button
        onClick={onToggleFavorite}
        aria-label="收藏"
        aria-pressed={isFavorite}
        className="shrink-0 p-3"
      >
        {isFavorite ? (
          <IconHeartFilled size={20} className="text-favorite" />
        ) : (
          <IconHeart size={20} className="text-text-tertiary" />
        )}
      </button>
    </div>
  )
}
