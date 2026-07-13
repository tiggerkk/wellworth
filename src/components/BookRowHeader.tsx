/**
 * Standardized 3-line book identity block — reused everywhere a book row is shown: every Books
 * Dashboard shelf (Favourites / Currently Reading / Recently Read / Want to Read) and the Library.
 * Presentational only; each caller supplies its own wrapping element (button, SwipeRow content,
 * etc.), thumbnail, and any trailing action (Mark Read / Start Reading) so the identity block is
 * always visually identical no matter where it renders.
 *
 * Line 1: ♥ (if favourite) · Title (+ year) · Dynasty chip (if not null)
 * Line 2: Status chip · Rating (if not null) · Start/Finish date (per status, see BookDateHint)
 * Line 3: Author(s) · Genre (first genre only)
 */
import { IconHeartFilled } from '@tabler/icons-react'
import { BOOK_STATUS_LABELS, BOOK_STATUS_CHIP, type BookStatus } from '../constants/books'
import { DYNASTY_CHIP } from '../constants/dynasty'
import { formatMonthDay, type IsoDate } from '../lib/date'
import type { BookRow } from '../lib/books'
import { StatusChip } from './StatusChip'
import { StarRating } from './StarRating'

type BookRowHeaderProps = {
  book: Pick<
    BookRow,
    | 'title'
    | 'year'
    | 'is_favorite'
    | 'dynasty'
    | 'status'
    | 'rating'
    | 'start_date'
    | 'end_date'
    | 'authors'
    | 'genres'
  >
}

/** Presentational: renders the 3 lines only. Each caller wraps this in its own sizing element
 * (a `min-w-0 flex-1` span/button) so truncation is governed by the caller's layout, not this component. */
export function BookRowHeader({ book }: BookRowHeaderProps) {
  const status = book.status as BookStatus
  const hasByline = !!book.authors?.length || !!book.genres?.[0]

  return (
    <>
      <span className="flex items-center gap-1.5 text-body text-text-primary">
        {book.is_favorite && (
          <IconHeartFilled
            size={13}
            className="shrink-0 text-favorite"
            aria-label="Favourite"
          />
        )}
        <span className="min-w-0 truncate">
          {book.title}
          {book.year ? ` (${book.year})` : ''}
        </span>
        {book.dynasty && (
          <StatusChip label={book.dynasty} className={`shrink-0 ${DYNASTY_CHIP}`} />
        )}
      </span>

      <span className="mt-0.5 flex items-center gap-2 text-caption text-text-secondary">
        <StatusChip
          label={BOOK_STATUS_LABELS[status]}
          className={BOOK_STATUS_CHIP[status]}
        />
        {book.rating ? <StarRating value={book.rating} size={12} /> : null}
        <BookDateHint
          status={status}
          startDate={book.start_date}
          endDate={book.end_date}
        />
      </span>

      {hasByline && (
        <span className="mt-0.5 flex items-center gap-1 text-caption text-text-tertiary">
          {book.authors?.length ? (
            <span className="min-w-0 truncate">{book.authors.join(', ')}</span>
          ) : null}
          {book.authors?.length && book.genres?.[0] ? <span>·</span> : null}
          {book.genres?.[0] && <span className="shrink-0">{book.genres[0]}</span>}
        </span>
      )}
    </>
  )
}

/** Line 2's date cue: "Started {date}" while reading; a bare finish/drop date once done. Nothing
 * for "want" (there's no date yet). */
function BookDateHint({
  status,
  startDate,
  endDate,
}: {
  status: BookStatus
  startDate: IsoDate | null
  endDate: IsoDate | null
}) {
  if (status === 'reading' && startDate) {
    return <span>Started {formatMonthDay(startDate)}</span>
  }
  if ((status === 'read' || status === 'dropped') && endDate) {
    return <span>{formatMonthDay(endDate)}</span>
  }
  return null
}
