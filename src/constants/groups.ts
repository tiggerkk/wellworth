/** Diary groups, in display order (docs/01-screens.md). */
export type GroupName =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snacks'
  | 'supplements'
  | 'activities'

export interface DiaryGroup {
  key: GroupName
  label: string
  /** Food groups accept foods; the activities group accepts activities. */
  kind: 'food' | 'activity'
}

export const DIARY_GROUPS: DiaryGroup[] = [
  { key: 'breakfast', label: 'Breakfast', kind: 'food' },
  { key: 'lunch', label: 'Lunch', kind: 'food' },
  { key: 'dinner', label: 'Dinner', kind: 'food' },
  { key: 'snacks', label: 'Snacks', kind: 'food' },
  { key: 'supplements', label: 'Supplements', kind: 'food' },
  { key: 'activities', label: 'Activities', kind: 'activity' },
]
