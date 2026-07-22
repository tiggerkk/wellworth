/**
 * Shared semantic tones for `StatusChip`, used across Books/Shows/Travel/Insurance. Each module's
 * `*_STATUS_CHIP` map picks a tone per status; `STATUS_TONE_CLASS` is the single place that maps a
 * tone to its actual colour so the whole app's status palette can be tweaked in one spot.
 */
export const STATUS_TONES = ['want', 'ongoing', 'done', 'dropped', 'break-even'] as const
export type StatusTone = (typeof STATUS_TONES)[number]

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  want: 'bg-plan/15 text-plan',
  ongoing: 'bg-warning/15 text-warning',
  done: 'bg-positive/15 text-positive',
  dropped: 'bg-track/15 text-text-secondary',
  'break-even': 'bg-accent/15 text-accent',
}
