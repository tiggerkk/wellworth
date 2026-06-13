import type { TablesInsert } from '../types/database'

/**
 * The owner's starter activity library (docs/05-seed-data.md), seeded once on first
 * login. `met_by_effort` maps each effort level to its Compendium MET; `default_effort`
 * must be a key present in the map. Icon strings resolve via src/constants/activity-icons.ts.
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
    met_by_effort: { vigorous: 7.0 },
    icon: 'IconKarate',
  },
  {
    name: '八段锦 (Baduanjin)',
    description: 'Gentle qigong',
    template: 'duration',
    default_effort: 'light',
    met_by_effort: { light: 3.0 },
    icon: 'IconStretching',
  },
  {
    name: 'Stretching',
    description: 'Shoulder/Neck stretches',
    template: 'duration',
    default_effort: 'light',
    met_by_effort: { light: 2.3 },
    icon: 'IconStretching2',
  },
  {
    name: 'Yoga',
    description: 'General',
    template: 'duration',
    default_effort: 'light',
    met_by_effort: { light: 2.5 },
    icon: 'IconYoga',
  },
  {
    name: 'Weight Training',
    description: '8–15 reps, standard rest',
    template: 'strength',
    default_effort: 'moderate',
    met_by_effort: { light: 3.5, moderate: 3.5 },
    icon: 'IconBarbell',
  },
  {
    name: 'Powerlifting',
    description: 'Heavy sets',
    template: 'strength',
    default_effort: 'vigorous',
    met_by_effort: { vigorous: 6.0 },
    icon: 'IconBarbell',
  },
  {
    name: 'Circuit Training',
    description: 'Fast-paced, minimal rest, high heart rate',
    template: 'strength',
    default_effort: 'vigorous',
    met_by_effort: { vigorous: 8.0 },
    icon: 'IconBarbell',
  },
  {
    name: 'Swimming',
    description: 'Leisurely',
    template: 'duration',
    default_effort: 'moderate',
    met_by_effort: { moderate: 5.9 },
    icon: 'IconSwimming',
  },
  {
    name: 'Walking',
    description: '~3 mph',
    template: 'duration',
    default_effort: 'moderate',
    met_by_effort: { moderate: 3.5 },
    icon: 'IconWalk',
  },
]
