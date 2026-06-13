/** Activity effort levels with their MET intensity bands (docs/05-seed-data.md). */
export type Effort = 'light' | 'moderate' | 'vigorous'

export interface EffortLevel {
  key: Effort
  label: string
  range: string
}

export const EFFORT_LEVELS: EffortLevel[] = [
  { key: 'light', label: 'Light', range: '< 3 MET' },
  { key: 'moderate', label: 'Moderate', range: '3–5.9 MET' },
  { key: 'vigorous', label: 'Vigorous', range: '≥ 6 MET' },
]
