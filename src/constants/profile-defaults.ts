import type { TablesInsert } from '../types/database'

/**
 * Neutral first-run seed for a NON-owner family member (docs/05-seed-data.md). Only contains
 * defaults that are safe for anyone — no body metrics. Body fields (birthday/sex/height/weight/
 * protein target) are intentionally omitted so they stay NULL, which (together with a null
 * `onboarded_at`) routes the member through the forced onboarding wizard. `visible_nutrients`
 * and `medical_tracked_tests` are NOT here — they're derived at seed time from reference data
 * (see src/data/nutrient.ts + src/lib/medical.ts) and are neutral for everyone.
 */
export const MEMBER_PROFILE_SEED = {
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

/**
 * First-run profile seed for the OWNER (docs/05-seed-data.md). The owner keeps a fully-populated
 * profile and skips onboarding (see ensureOwnerProfile, which also stamps `onboarded_at`). These
 * are the owner's personal body metrics and must NEVER be applied to other users — non-owners get
 * MEMBER_PROFILE_SEED instead and enter their own metrics in the onboarding wizard.
 */
export const OWNER_PROFILE_SEED = {
  ...MEMBER_PROFILE_SEED,
  birthday: '1974-09-06',
  sex: 'female',
  height_cm: 171,
  weight_kg: 56,
  protein_target_g: 90,
} satisfies Partial<TablesInsert<'profile'>>
