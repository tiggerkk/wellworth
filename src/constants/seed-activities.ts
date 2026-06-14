import type { TablesInsert } from '../types/database'

/**
 * The owner's starter activity library (docs/05-seed-data.md), seeded once on first
 * login. `met_by_effort` maps each effort level to its Compendium MET; `default_effort`
 * must be a key present in the map. `default_duration_min` prefills the Activity Log.
 * Icon strings resolve via src/constants/activity-icons.ts.
 *
 * MULTI-USER NOTE: like the profile seed, this is the owner's set. Future family users
 * would start with an empty library (or a neutral shared default), not these.
 */
export type SeedActivity = Omit<TablesInsert<'activity'>, 'user_id'>

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
