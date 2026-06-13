import { ageFromBirthday, bmrMifflinStJeor, energyTarget, type Sex } from './energy'
import { getDriForProfile, type NutrientDri } from './dri'
import type { Tables } from '../types/database'

export interface Targets {
  bmr: number
  energyTargetKcal: number
  dri: Record<string, NutrientDri>
}

/**
 * Resolve a profile's BMR, energy target, and per-nutrient DRI targets. Returns null when
 * the profile lacks the body metrics BMR needs, or when the sex/age band is unsupported
 * (Phase 1 = adult female 51–70). Used by the Diary grid, Dashboard, and Food Detail.
 */
export function computeTargets(profile: Tables<'profile'>): Targets | null {
  const { birthday, sex, weight_kg, height_cm, activity_factor, protein_target_g } =
    profile
  if (!birthday || !sex || weight_kg == null || height_cm == null) return null

  const age = ageFromBirthday(birthday)
  const bmr = bmrMifflinStJeor({
    weightKg: weight_kg,
    heightCm: height_cm,
    age,
    sex: sex as Sex,
  })
  const energyTargetKcal = energyTarget(bmr, activity_factor)
  try {
    const dri = getDriForProfile(
      { sex, birthdayAge: age, proteinTargetG: protein_target_g },
      energyTargetKcal,
    )
    return { bmr, energyTargetKcal, dri }
  } catch {
    return null
  }
}
