import type { ComponentType } from 'react'
import { IconApple, IconCookie, IconPill, IconRun } from '@tabler/icons-react'

/** Diary groups, in display order (docs/01-screens.md). */
export type GroupName =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snacks'
  | 'supplements'
  | 'activities'

type GroupIcon = ComponentType<{ size?: number; className?: string }>

export interface DiaryGroup {
  key: GroupName
  label: string
  /** Food groups accept foods; the activities group accepts activities. */
  kind: 'food' | 'activity'
  /** Leading category icon shown in the group header. */
  Icon: GroupIcon
  /** Tailwind text-color for the icon (intentional per-category colors). */
  iconClass: string
}

// Per-category icon colors live as `cat-*` tokens in index.css (red apple / orange cookie /
// purple pill / blue runner).
const MEAL = { Icon: IconApple, iconClass: 'text-cat-meal' }

export const DIARY_GROUPS: DiaryGroup[] = [
  { key: 'breakfast', label: 'Breakfast', kind: 'food', ...MEAL },
  { key: 'lunch', label: 'Lunch', kind: 'food', ...MEAL },
  { key: 'dinner', label: 'Dinner', kind: 'food', ...MEAL },
  {
    key: 'snacks',
    label: 'Snacks',
    kind: 'food',
    Icon: IconCookie,
    iconClass: 'text-cat-snack',
  },
  {
    key: 'supplements',
    label: 'Supplements',
    kind: 'food',
    Icon: IconPill,
    iconClass: 'text-cat-supplement',
  },
  {
    key: 'activities',
    label: 'Activities',
    kind: 'activity',
    Icon: IconRun,
    iconClass: 'text-cat-activity',
  },
]
