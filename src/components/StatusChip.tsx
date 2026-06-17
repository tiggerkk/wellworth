import { SHOW_STATUS_CHIP, SHOW_STATUS_LABELS, type ShowStatus } from '../lib/shows'

/** A status pill (Want to Watch / Watching / Watched / Dropped) in the per-status palette. */
export function StatusChip({ status }: { status: ShowStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${SHOW_STATUS_CHIP[status]}`}
    >
      {SHOW_STATUS_LABELS[status]}
    </span>
  )
}
