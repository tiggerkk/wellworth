interface ResultCountProps {
  count: number
  className?: string
}

/**
 * Small muted "N results" line shown above a filtered list on every Library/Reports/Trips
 * screen, so the search/filter result size is always visible.
 */
export function ResultCount({ count, className = '' }: ResultCountProps) {
  return (
    <p className={`px-1 text-caption text-text-secondary ${className}`}>
      {count} {count === 1 ? 'result' : 'results'}
    </p>
  )
}
