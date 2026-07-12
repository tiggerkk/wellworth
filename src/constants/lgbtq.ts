/**
 * Used by Shows and Books modules.
 */
export const LGBTQ_REPS = ['none', 'some', 'significant'] as const
export type LgbtqRep = (typeof LGBTQ_REPS)[number]
export const LGBTQ_REP_LABELS: Record<LgbtqRep, string> = {
  none: 'None',
  some: 'Some',
  significant: 'Significant',
}
