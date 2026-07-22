/**
 * Standardized 3-line show identity block — reused everywhere a show row is shown: every Shows Dashboard
 * shelf and the Library. Presentational only; each caller supplies its own wrapping element, thumbnail,
 * and any trailing action so the identity block is always visually identical no matter where it renders.
 * The favourite indicator itself lives on the caller's `ListRow`/`DashboardRow`, not here.
 *
 * Line 1: Title (+ year) · Dynasty chip (if not null)
 * Line 2: Status chip · Rating (if not null) · Start/Finish date (per status)
 * Line 3: TV/Movie/Doc icon · Progress info (see showProgressInfo) · Genre (first genre only)
 */
import {
  SHOW_STATUS_LABELS,
  SHOW_STATUS_CHIP,
  type ShowStatus,
  type ShowType,
} from '../constants/shows'
import { formatMonthDay, type IsoDate } from '../lib/date'
import { lengthHint, progressLabel, usesEpisodes, type ShowRow } from '../lib/shows'
import { DynastyChip } from './DynastyChip'
import { ShowTypeBadge } from './ShowTypeBadge'
import { StatusChip } from './StatusChip'
import { StarRating } from './StarRating'

type ShowRowHeaderProps = {
  show: Pick<
    ShowRow,
    | 'title'
    | 'year'
    | 'dynasty'
    | 'status'
    | 'type'
    | 'rating'
    | 'start_date'
    | 'end_date'
    | 'genres'
    | 'runtime_min'
    | 'total_seasons'
    | 'total_episodes'
    | 'watched_seasons'
    | 'watched_episodes'
  >
}

/** Presentational: renders the 3 lines only. Each caller wraps this in its own sizing element
 * (a `min-w-0 flex-1` span/button) so truncation is governed by the caller's layout, not this component. */
export function ShowRowHeader({ show }: ShowRowHeaderProps) {
  const status = show.status as ShowStatus
  const progress = showProgressInfo(show, status)
  const hasByline = !!progress || !!show.genres?.[0]

  return (
    <>
      <span className="flex items-center gap-1.5 text-body text-text-primary">
        <span className="min-w-0 truncate">
          {show.title}
          {show.year ? ` (${show.year})` : ''}
        </span>
        {show.dynasty && <DynastyChip dynasty={show.dynasty} />}
      </span>

      <span className="mt-0.5 flex items-center gap-2 text-caption text-text-secondary">
        <StatusChip label={SHOW_STATUS_LABELS[status]} tone={SHOW_STATUS_CHIP[status]} />
        {show.rating ? <StarRating value={show.rating} size={12} /> : null}
        <ShowDateHint
          status={status}
          startDate={show.start_date}
          endDate={show.end_date}
        />
      </span>

      {hasByline && (
        <span className="mt-0.5 flex items-center gap-1 text-caption text-text-tertiary">
          <ShowTypeBadge type={show.type as ShowType} />
          {progress && <span className="shrink-0">{progress}</span>}
          {progress && show.genres?.[0] ? <span>·</span> : null}
          {show.genres?.[0] && <span className="min-w-0 truncate">{show.genres[0]}</span>}
        </span>
      )}
    </>
  )
}

/** Line 2's date cue: "Started {date}" while watching; a bare finish/drop date once done. Nothing
 * for "want" (there's no date yet). */
function ShowDateHint({
  status,
  startDate,
  endDate,
}: {
  status: ShowStatus
  startDate: IsoDate | null
  endDate: IsoDate | null
}) {
  if (status === 'watching' && startDate) {
    return <span>Started {formatMonthDay(startDate)}</span>
  }
  if ((status === 'watched' || status === 'dropped') && endDate) {
    return <span>{formatMonthDay(endDate)}</span>
  }
  return null
}

/**
 * Line 3's progress cue: a movie/non-episodic title always shows its length hint (runtime); an
 * episodic title (TV/documentary) shows a season/episode count while wanting it, live progress
 * while watching, and the final recap once watched/dropped — null when there's nothing to show.
 */
function showProgressInfo(
  show: Parameters<typeof lengthHint>[0] & Parameters<typeof progressLabel>[0],
  status: ShowStatus,
): string | null {
  if (!usesEpisodes(show.type)) return lengthHint(show)
  if (status === 'want') return lengthHint(show)
  if ((show.total_episodes ?? 0) > 0) return progressLabel(show)
  return null
}
