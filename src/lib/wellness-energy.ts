/**
 * Energy & body-metric calculations (docs/02-tech-spec.md). Pure functions, metric in.
 */

export type Sex = 'female' | 'male'

/** Whole years from an ISO `YYYY-MM-DD` birthday to `asOf` (default: now). */
export function ageFromBirthday(birthday: string, asOf: Date = new Date()): number {
  const b = new Date(birthday)
  let age = asOf.getFullYear() - b.getFullYear()
  const monthDelta = asOf.getMonth() - b.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getDate() < b.getDate())) {
    age -= 1
  }
  return age
}

export interface BmrInput {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
}

/** Basal metabolic rate, Mifflin–St Jeor: 10·kg + 6.25·cm − 5·age (+5 male / −161 female). */
export function bmrMifflinStJeor({ weightKg, heightCm, age, sex }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

/** Daily energy (calorie) target = BMR × activity factor (default factor 1.4). */
export function energyTarget(bmr: number, activityFactor: number): number {
  return bmr * activityFactor
}

export interface NetEnergyInput {
  consumed: number
  bmr: number
  /** Energy burned by logged activity, as a positive magnitude. */
  activity: number
}

/** Net energy = Consumed − BMR − Activity. */
export function netEnergy({ consumed, bmr, activity }: NetEnergyInput): number {
  return consumed - bmr - activity
}
