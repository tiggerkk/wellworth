import {
  IconApple,
  IconCookie,
  IconPill,
  IconBarbell,
  IconKarate,
  IconRun,
  IconStretching,
  IconStretching2,
  IconSwimming,
  IconWalk,
  IconYoga,
  type Icon,
} from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { addDays, fromIsoDate, toIsoDate, type IsoDate } from '../lib/date'
import type { TablesInsert } from '../types/database'

// --- Date Range --------------------------------------------------------------------------------

interface DateRange {
  from: IsoDate
  to: IsoDate
}

interface RangeOption {
  key: string
  label: string
  toRange: (today: IsoDate) => DateRange
}

const lastNDays =
  (n: number) =>
  (today: IsoDate): DateRange => ({ from: addDays(today, -(n - 1)), to: today })

const monthsAgo =
  (n: number) =>
  (today: IsoDate): DateRange => {
    const d = fromIsoDate(today)
    d.setMonth(d.getMonth() - n)
    return { from: toIsoDate(d), to: today }
  }

/**
 * Wellness Dashboard range options. Pure UI constants — not persisted; edit freely (add/remove/relabel
 * windows, change the day/month counts) and the change takes effect on reload, with no DB or other code
 * change. The only coupling is the default below, which the screen reads instead of hardcoding a key.
 */
export const WELLNESS_RANGES: RangeOption[] = [
  { key: '7d', label: 'Last 7 Days', toRange: lastNDays(7) },
  { key: '2w', label: 'Last 2 Weeks', toRange: lastNDays(14) },
  { key: '3w', label: 'Last 3 Weeks', toRange: lastNDays(21) },
  { key: '4w', label: 'Last 4 Weeks', toRange: lastNDays(28) },
  { key: '8w', label: 'Last 8 Weeks', toRange: lastNDays(56) },
  { key: '3m', label: 'Last 3 Months', toRange: monthsAgo(3) },
  { key: '6m', label: 'Last 6 Months', toRange: monthsAgo(6) },
  { key: '1y', label: 'Last Year', toRange: monthsAgo(12) },
]

/** Default selected window. Must be one of WELLNESS_RANGES' keys (keep the default here, not in the screen). */
export const WELLNESS_RANGE_DEFAULT = '7d'

// --- Diary groups --------------------------------------------------------------------------------

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

// --- Food types + sources (Foods listing filter/sort) ---------------------------------------------

export type FoodType = 'food' | 'supplement'

export const FOOD_TYPES: { key: FoodType; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'supplement', label: 'Supplement' },
]

export type FoodSource = 'custom' | 'usda' | 'off'

export const FOOD_SOURCES: { key: FoodSource; label: string }[] = [
  { key: 'custom', label: 'Custom' },
  { key: 'usda', label: 'USDA' },
  { key: 'off', label: 'Off' },
]

// --- Nutrient sections (Dashboard / Daily Report) -------------------------------------------------

interface NutrientSection {
  category: string
  label: string
}

export const NUTRIENT_SECTIONS: NutrientSection[] = [
  { category: 'general', label: 'General' },
  { category: 'vitamins', label: 'Vitamins' },
  { category: 'minerals', label: 'Minerals' },
  { category: 'carbohydrates', label: 'Carbohydrates' },
  { category: 'lipids', label: 'Lipids' },
  { category: 'protein', label: 'Protein & Amino Acids' },
]

// --- Activity icons --------------------------------------------------------------------------------

/**
 * Maps the Tabler component-name string stored in `activity.icon` to the imported
 * component. Only the icons the app uses are imported (tree-shaking safe — do NOT use
 * `import * as TablerIcons`). Null/unknown falls back to DEFAULT_ACTIVITY_ICON.
 */
export const ACTIVITY_ICONS: Record<string, Icon> = {
  IconKarate,
  IconStretching,
  IconStretching2,
  IconYoga,
  IconBarbell,
  IconSwimming,
  IconWalk,
  IconRun,
}

const DEFAULT_ACTIVITY_ICON: Icon = IconRun

export function resolveActivityIcon(name: string | null): Icon {
  return (name && ACTIVITY_ICONS[name]) || DEFAULT_ACTIVITY_ICON
}

// --- Activity templates --------------------------------------------------------------------------

export type ActivityTemplate = 'duration' | 'strength'

export const ACTIVITY_TEMPLATES: { key: ActivityTemplate; label: string }[] = [
  { key: 'duration', label: 'Duration' },
  { key: 'strength', label: 'Strength' },
]

export function activityTemplateLabel(template: string): string {
  return ACTIVITY_TEMPLATES.find((t) => t.key === template)?.label ?? template
}

// --- Activity effort levels with their MET intensity bands ---------------------------------------

export type Effort = 'light' | 'moderate' | 'vigorous'

interface EffortLevel {
  key: Effort
  label: string
  range: string
}

export const EFFORT_LEVELS: EffortLevel[] = [
  { key: 'light', label: 'Light', range: '≤ 3 MET' },
  { key: 'moderate', label: 'Moderate', range: '3.1–5.9 MET' },
  { key: 'vigorous', label: 'Vigorous', range: '≥ 6 MET' },
]

// --- Seed activities --------------------------------------------------------------------------------

/**
 * The owner's starter activity library (docs/05-seed-data.md), seeded once on first
 * login. `met_by_effort` maps each effort level to its Compendium MET; `default_effort`
 * must be a key present in the map. `default_duration_min` prefills the Activity Log.
 * Icon strings resolve via src/constants/activity-icons.ts.
 *
 * MULTI-USER NOTE: like the profile seed, this is the owner's set. Future family users
 * would start with an empty library (or a neutral shared default), not these.
 */
type SeedActivity = Omit<TablesInsert<'activity'>, 'user_id'>

export const OWNER_SEED_ACTIVITIES: SeedActivity[] = [
  {
    name: 'Body Combat',
    description: 'High-intensity martial-arts cardio',
    template: 'duration',
    default_effort: 'vigorous',
    default_duration_min: 60,
    met_by_effort: { light: 3.0, moderate: 5.9, vigorous: 7.0 },
    icon: 'IconKarate',
  },
  {
    name: '八段锦 (Baduanjin)',
    description: 'Gentle qigong',
    template: 'duration',
    default_effort: 'light',
    default_duration_min: 10,
    met_by_effort: { light: 3.0 },
    icon: 'IconStretching',
  },
  {
    name: 'Stretching',
    description: 'Shoulder/Neck stretches',
    template: 'duration',
    default_effort: 'light',
    default_duration_min: 10,
    met_by_effort: { light: 2.3 },
    icon: 'IconStretching2',
  },
  {
    name: 'Yoga',
    description: 'General',
    template: 'duration',
    default_effort: 'light',
    default_duration_min: 15,
    met_by_effort: { light: 2.5, moderate: 3.5 },
    icon: 'IconYoga',
  },
  {
    name: 'Weights - General',
    description: '8–15 reps, standard rest',
    template: 'strength',
    default_effort: 'moderate',
    default_duration_min: 20,
    met_by_effort: { light: 3.0, moderate: 3.5 },
    icon: 'IconBarbell',
  },
  {
    name: 'Weights - Powerlifting',
    description: 'Heavy sets',
    template: 'strength',
    default_effort: 'vigorous',
    default_duration_min: 20,
    met_by_effort: { vigorous: 6.0 },
    icon: 'IconBarbell',
  },
  {
    name: 'Weights - Circuit',
    description: 'Fast-paced, minimal rest, high heart rate',
    template: 'strength',
    default_effort: 'vigorous',
    default_duration_min: 20,
    met_by_effort: { vigorous: 8.0 },
    icon: 'IconBarbell',
  },
  {
    name: 'Swimming',
    description: 'Leisurely',
    template: 'duration',
    default_effort: 'moderate',
    default_duration_min: 30,
    met_by_effort: { light: 3.0, moderate: 5.9, vigorous: 6.5 },
    icon: 'IconSwimming',
  },
  {
    name: 'Walking',
    description: '~3 mph',
    template: 'duration',
    default_effort: 'moderate',
    default_duration_min: 30,
    met_by_effort: { moderate: 3.3 },
    icon: 'IconWalk',
  },
  {
    name: 'Running - Jog',
    description: '~4 mph',
    template: 'duration',
    default_effort: 'moderate',
    default_duration_min: 30,
    met_by_effort: { moderate: 5.9 },
    icon: 'IconRun',
  },
  {
    name: 'Running - Fast',
    description: '~6 mph',
    template: 'duration',
    default_effort: 'vigorous',
    default_duration_min: 30,
    met_by_effort: { vigorous: 9.8 },
    icon: 'IconRun',
  },
]
