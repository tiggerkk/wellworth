import { STATUS_TONE_CLASS, type StatusTone } from '../constants/chips'

interface StatusChipProps {
  /** The label to show (e.g. 'Watching', 'Reading'). */
  label: string
  /** Semantic status tone (from the module's `*_STATUS_CHIP` map); resolves to this chip's colour. */
  tone?: StatusTone
  /** Extra/override classes, layered on top of the tone's colour. */
  className?: string
}

/** A status pill, tinted (15% opacity) rounded-pill by semantic tone. Presentational — Books, Shows,
 * Travel, and Insurance each map their own statuses to a shared tone so the chip look stays uniform. */
export function StatusChip({ label, tone, className = '' }: StatusChipProps) {
  const toneClass = tone ? STATUS_TONE_CLASS[tone] : ''
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-section font-medium ${toneClass} ${className}`}
    >
      {label}
    </span>
  )
}
