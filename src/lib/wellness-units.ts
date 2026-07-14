/**
 * Unit conversion helpers.
 *
 * WellWorth stores everything in metric (kg, cm, g, ml). Imperial is a display-only
 * preference applied at the UI boundary — never persisted. See docs/02-tech-spec.md.
 * kcal is unit-independent.
 */

export const GRAMS_PER_OZ = 28.3495
export const GRAMS_PER_LB = 453.592
export const CM_PER_INCH = 2.54
export const ML_PER_FL_OZ = 29.5735

export const gramsToOunces = (g: number): number => g / GRAMS_PER_OZ
export const ouncesToGrams = (oz: number): number => oz * GRAMS_PER_OZ

export const gramsToPounds = (g: number): number => g / GRAMS_PER_LB
export const poundsToGrams = (lb: number): number => lb * GRAMS_PER_LB

export const kgToPounds = (kg: number): number => (kg * 1000) / GRAMS_PER_LB
export const poundsToKg = (lb: number): number => (lb * GRAMS_PER_LB) / 1000

export const cmToInches = (cm: number): number => cm / CM_PER_INCH
export const inchesToCm = (inch: number): number => inch * CM_PER_INCH

export const mlToFluidOunces = (ml: number): number => ml / ML_PER_FL_OZ
export const fluidOuncesToMl = (flOz: number): number => flOz * ML_PER_FL_OZ
