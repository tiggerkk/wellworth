import type { TablesInsert } from '../types/database'

/**
 * First-run profile seed for the OWNER (docs/05-seed-data.md). Phase 1 is single-user,
 * so on first login we create a fully-populated profile from these values; the owner
 * then tweaks them in Settings. `visible_nutrients` is NOT here — it is derived at seed
 * time from the nutrient table's default_visible flag (see src/data/nutrient.ts).
 *
 * ── MULTI-USER CHANGE (future family members) ──────────────────────────────────────
 * These are the owner's personal body metrics and must NOT be applied to other users.
 * When family support is added, branch in useEnsureProfile / the seeding path so that
 * non-owner users get only neutral defaults (activity_factor, units, the default
 * visible/highlighted sets) and are routed through an onboarding/Settings step to enter
 * their own birthday/sex/height/weight/protein target — never inheriting these.
 */
export const OWNER_PROFILE_SEED = {
  birthday: '1974-09-06',
  sex: 'female',
  height_cm: 171,
  weight_kg: 56,
  protein_target_g: 90,
  activity_factor: 1.4,
  units: 'metric',
  highlighted_nutrients: [
    'protein',
    'fiber',
    'vitamin_d',
    'calcium',
    'iron',
    'magnesium',
    'folate',
    'potassium',
  ],
} satisfies Partial<TablesInsert<'profile'>>
