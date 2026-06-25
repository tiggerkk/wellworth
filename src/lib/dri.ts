/**
 * Dietary Reference Intakes (DRI) lookup. Values are from the NASEM/IOM DRI tables (as
 * published by the NIH Office of Dietary Supplements): RDA where one exists, otherwise AI.
 *
 * ── SCOPE: adult bands 31+ ───────────────────────────────────────────────────────────
 * Populated bands: ADULT FEMALE and MALE, each 31–50 · 51–70 · 71+ (covers the family's adults
 * from 31 through 71+). The lookup is keyed by `${sex}:${ageBand}`. Ages under 31 (and any other
 * sex value) are unpopulated — `getDriForProfile` throws and `computeTargets` returns null (the UI
 * just shows no targets). HOW TO ADD A BAND: add a `Record<string, StaticDri>` (transcribe the
 * RDA/AI + UL values, or spread a nearby band and override only the differences, as the 31–50/71+
 * bands do), register it in DRI_TABLES, and extend `bandFor()` to map ages → band.
 *
 * ── UPPER LIMITS ARE SCOPE-TAGGED ────────────────────────────────────────────────────
 * Several DRI ULs apply only to supplemental/synthetic forms, which a normal diet exceeds
 * (e.g. dietary magnesium routinely tops the 350 mg supplemental UL). `ulScope` records
 * which kind each UL is; the red over-limit bar (see isOverUpperLimit in nutrients.ts)
 * fires only for 'total', 'cdrr', and 'guidance' — never 'supplemental'.
 *   - vitamin_a UL is preformed RETINOL only (not carotenoids) → 'supplemental' here.
 *   - sodium has no classical UL; 2300 mg is the chronic-disease-risk reduction (CDRR).
 *   - added_sugars/saturated/fat targets are energy-derived (see ENERGY_DERIVED below).
 */

export type TargetType = 'rda' | 'ai' | 'amdr' | 'guidance' | 'computed' | 'none'
export type UlScope = 'total' | 'supplemental' | 'cdrr' | 'guidance'

export interface NutrientDri {
  target: number | null
  targetType: TargetType
  ul: number | null
  ulScope: UlScope | null
}

type StaticDri = NutrientDri

// Adult female 51–70. Units match the nutrient reference table (µg, mg, g). Copper is in mg.
const FEMALE_51_70: Record<string, StaticDri> = {
  // General
  water: { target: 2700, targetType: 'ai', ul: null, ulScope: null },

  // Protein (RDA; overridden by profile.protein_target_g when set)
  protein: { target: 46, targetType: 'rda', ul: null, ulScope: null },

  // Carbohydrates
  carbs: { target: 130, targetType: 'rda', ul: null, ulScope: null },
  fiber: { target: 21, targetType: 'ai', ul: null, ulScope: null },

  // Lipids (fat / saturated / added_sugars are energy-derived; see ENERGY_DERIVED)
  omega3: { target: 1.1, targetType: 'ai', ul: null, ulScope: null }, // ALA
  omega6: { target: 11, targetType: 'ai', ul: null, ulScope: null }, // linoleic acid

  // Vitamins
  vitamin_a: { target: 700, targetType: 'rda', ul: 3000, ulScope: 'supplemental' }, // UL = retinol only
  vitamin_c: { target: 75, targetType: 'rda', ul: 2000, ulScope: 'total' },
  vitamin_d: { target: 15, targetType: 'rda', ul: 100, ulScope: 'total' }, // µg (600 IU / UL 4000 IU)
  vitamin_e: { target: 15, targetType: 'rda', ul: 1000, ulScope: 'supplemental' },
  vitamin_k: { target: 90, targetType: 'ai', ul: null, ulScope: null },
  b1: { target: 1.1, targetType: 'rda', ul: null, ulScope: null },
  b2: { target: 1.1, targetType: 'rda', ul: null, ulScope: null },
  b3: { target: 14, targetType: 'rda', ul: 35, ulScope: 'supplemental' }, // mg NE; UL is supplemental niacin
  b5: { target: 5, targetType: 'ai', ul: null, ulScope: null },
  b6: { target: 1.5, targetType: 'rda', ul: 100, ulScope: 'total' },
  b12: { target: 2.4, targetType: 'rda', ul: null, ulScope: null },
  folate: { target: 400, targetType: 'rda', ul: 1000, ulScope: 'supplemental' }, // µg DFE; UL is folic acid
  b7: { target: 30, targetType: 'ai', ul: null, ulScope: null },
  choline: { target: 425, targetType: 'ai', ul: 3500, ulScope: 'total' },

  // Minerals
  calcium: { target: 1200, targetType: 'rda', ul: 2000, ulScope: 'total' },
  copper: { target: 0.9, targetType: 'rda', ul: 10, ulScope: 'total' }, // mg
  iodine: { target: 150, targetType: 'rda', ul: 1100, ulScope: 'total' },
  iron: { target: 8, targetType: 'rda', ul: 45, ulScope: 'total' },
  magnesium: { target: 320, targetType: 'rda', ul: 350, ulScope: 'supplemental' },
  manganese: { target: 1.8, targetType: 'ai', ul: 11, ulScope: 'total' },
  phosphorus: { target: 700, targetType: 'rda', ul: 4000, ulScope: 'total' },
  potassium: { target: 2600, targetType: 'ai', ul: null, ulScope: null },
  selenium: { target: 55, targetType: 'rda', ul: 400, ulScope: 'total' },
  sodium: { target: 1500, targetType: 'ai', ul: 2300, ulScope: 'cdrr' },
  zinc: { target: 8, targetType: 'rda', ul: 40, ulScope: 'total' },
  chromium: { target: 20, targetType: 'ai', ul: null, ulScope: null },
  fluoride: { target: 3, targetType: 'ai', ul: 10, ulScope: 'total' },
  molybdenum: { target: 45, targetType: 'rda', ul: 2000, ulScope: 'total' },
  chloride: { target: 2300, targetType: 'ai', ul: 3600, ulScope: 'total' },
}

// Adult female 31–50. Same source/units as FEMALE_51_70; only the values that the NASEM/IOM tables
// change between the 31–50 and 51–70 female bands are overridden (the rest are spread from 51–70):
//   - iron 18 (premenopausal need) vs 8
//   - calcium target 1000 / UL 2500 vs 1200 / UL 2000 (the UL drops to 2000 at 51)
//   - fiber 25 (AI) vs 21
//   - omega6 / linoleic acid 12 (AI) vs 11
//   - b6 1.3 (RDA) vs 1.5
//   - chromium 25 (AI) vs 20
const FEMALE_31_50: Record<string, StaticDri> = {
  ...FEMALE_51_70,
  fiber: { target: 25, targetType: 'ai', ul: null, ulScope: null },
  omega6: { target: 12, targetType: 'ai', ul: null, ulScope: null }, // linoleic acid
  b6: { target: 1.3, targetType: 'rda', ul: 100, ulScope: 'total' },
  calcium: { target: 1000, targetType: 'rda', ul: 2500, ulScope: 'total' },
  iron: { target: 18, targetType: 'rda', ul: 45, ulScope: 'total' },
  chromium: { target: 25, targetType: 'ai', ul: null, ulScope: null },
}

// Adult female 71+. Spreads the 51–70 band; only vitamin D (600→800 IU) and the phosphorus UL
// (4000→3000 mg) change at 71 for women.
const FEMALE_71_PLUS: Record<string, StaticDri> = {
  ...FEMALE_51_70,
  vitamin_d: { target: 20, targetType: 'rda', ul: 100, ulScope: 'total' }, // µg (800 IU)
  phosphorus: { target: 700, targetType: 'rda', ul: 3000, ulScope: 'total' },
}

// Adult male 51–70. Same source/units as the female bands, but men's RDAs/AIs differ across many
// nutrients (larger reference body size), so this is a full band rather than a spread. ULs are not
// sex-specific.
const MALE_51_70: Record<string, StaticDri> = {
  // General
  water: { target: 3700, targetType: 'ai', ul: null, ulScope: null },

  // Protein
  protein: { target: 56, targetType: 'rda', ul: null, ulScope: null },

  // Carbohydrates
  carbs: { target: 130, targetType: 'rda', ul: null, ulScope: null },
  fiber: { target: 30, targetType: 'ai', ul: null, ulScope: null },

  // Lipids
  omega3: { target: 1.6, targetType: 'ai', ul: null, ulScope: null }, // ALA
  omega6: { target: 14, targetType: 'ai', ul: null, ulScope: null }, // linoleic acid

  // Vitamins
  vitamin_a: { target: 900, targetType: 'rda', ul: 3000, ulScope: 'supplemental' },
  vitamin_c: { target: 90, targetType: 'rda', ul: 2000, ulScope: 'total' },
  vitamin_d: { target: 15, targetType: 'rda', ul: 100, ulScope: 'total' }, // µg (600 IU)
  vitamin_e: { target: 15, targetType: 'rda', ul: 1000, ulScope: 'supplemental' },
  vitamin_k: { target: 120, targetType: 'ai', ul: null, ulScope: null },
  b1: { target: 1.2, targetType: 'rda', ul: null, ulScope: null },
  b2: { target: 1.3, targetType: 'rda', ul: null, ulScope: null },
  b3: { target: 16, targetType: 'rda', ul: 35, ulScope: 'supplemental' }, // mg NE; UL supplemental
  b5: { target: 5, targetType: 'ai', ul: null, ulScope: null },
  b6: { target: 1.7, targetType: 'rda', ul: 100, ulScope: 'total' },
  b12: { target: 2.4, targetType: 'rda', ul: null, ulScope: null },
  folate: { target: 400, targetType: 'rda', ul: 1000, ulScope: 'supplemental' }, // µg DFE; UL folic acid
  b7: { target: 30, targetType: 'ai', ul: null, ulScope: null },
  choline: { target: 550, targetType: 'ai', ul: 3500, ulScope: 'total' },

  // Minerals
  calcium: { target: 1000, targetType: 'rda', ul: 2000, ulScope: 'total' },
  copper: { target: 0.9, targetType: 'rda', ul: 10, ulScope: 'total' }, // mg
  iodine: { target: 150, targetType: 'rda', ul: 1100, ulScope: 'total' },
  iron: { target: 8, targetType: 'rda', ul: 45, ulScope: 'total' },
  magnesium: { target: 420, targetType: 'rda', ul: 350, ulScope: 'supplemental' },
  manganese: { target: 2.3, targetType: 'ai', ul: 11, ulScope: 'total' },
  phosphorus: { target: 700, targetType: 'rda', ul: 4000, ulScope: 'total' },
  potassium: { target: 3400, targetType: 'ai', ul: null, ulScope: null },
  selenium: { target: 55, targetType: 'rda', ul: 400, ulScope: 'total' },
  sodium: { target: 1500, targetType: 'ai', ul: 2300, ulScope: 'cdrr' },
  zinc: { target: 11, targetType: 'rda', ul: 40, ulScope: 'total' },
  chromium: { target: 30, targetType: 'ai', ul: null, ulScope: null },
  fluoride: { target: 4, targetType: 'ai', ul: 10, ulScope: 'total' },
  molybdenum: { target: 45, targetType: 'rda', ul: 2000, ulScope: 'total' },
  chloride: { target: 2300, targetType: 'ai', ul: 3600, ulScope: 'total' },
}

// Adult male 31–50. Spreads the male 51–70 band; overrides only the values that change between the
// two: fiber 38, linoleic acid 17, B6 1.3 (vs 1.7), calcium UL 2500 (drops to 2000 at 51; the male
// calcium RDA stays 1000 until 71), chromium 35.
const MALE_31_50: Record<string, StaticDri> = {
  ...MALE_51_70,
  fiber: { target: 38, targetType: 'ai', ul: null, ulScope: null },
  omega6: { target: 17, targetType: 'ai', ul: null, ulScope: null }, // linoleic acid
  b6: { target: 1.3, targetType: 'rda', ul: 100, ulScope: 'total' },
  calcium: { target: 1000, targetType: 'rda', ul: 2500, ulScope: 'total' },
  chromium: { target: 35, targetType: 'ai', ul: null, ulScope: null },
}

// Adult male 71+. Spreads the male 51–70 band; vitamin D rises (600→800 IU), the calcium RDA rises
// to 1200, and the phosphorus UL drops to 3000 at 71.
const MALE_71_PLUS: Record<string, StaticDri> = {
  ...MALE_51_70,
  vitamin_d: { target: 20, targetType: 'rda', ul: 100, ulScope: 'total' }, // µg (800 IU)
  calcium: { target: 1200, targetType: 'rda', ul: 2000, ulScope: 'total' },
  phosphorus: { target: 700, targetType: 'rda', ul: 3000, ulScope: 'total' },
}

const DRI_TABLES: Record<string, Record<string, StaticDri>> = {
  'female:31-50': FEMALE_31_50,
  'female:51-70': FEMALE_51_70,
  'female:71+': FEMALE_71_PLUS,
  'male:31-50': MALE_31_50,
  'male:51-70': MALE_51_70,
  'male:71+': MALE_71_PLUS,
}

// Energy-derived targets: a fraction of the day's energy target, converted to grams.
// kcalPerGram: fat 9, added sugars 4. `firesRed` adds an intake-based UL at the ceiling.
const ENERGY_DERIVED: Record<
  string,
  { pctEnergy: number; kcalPerGram: number; targetType: TargetType; firesRed: boolean }
> = {
  fat: { pctEnergy: 0.35, kcalPerGram: 9, targetType: 'amdr', firesRed: false },
  saturated: { pctEnergy: 0.1, kcalPerGram: 9, targetType: 'guidance', firesRed: false },
  added_sugars: {
    pctEnergy: 0.1,
    kcalPerGram: 4,
    targetType: 'guidance',
    firesRed: true,
  },
}

function bandFor(sex: string, age: number): string | null {
  // Adults 31+ only; under 31 (and any non-binary sex value) is unpopulated → no targets.
  if (age < 31 || (sex !== 'female' && sex !== 'male')) return null
  const tier = age <= 50 ? '31-50' : age <= 70 ? '51-70' : '71+'
  return `${sex}:${tier}`
}

export interface DriProfile {
  sex: string | null
  birthdayAge: number
  proteinTargetG: number | null
}

/**
 * Resolve the DRI map for a profile + the day's energy target (kcal). Merges the static
 * band table with the protein override and the energy-derived soft targets. Adds `energy`
 * with the computed kcal target. Throws for an unsupported sex/age band.
 */
export function getDriForProfile(
  profile: DriProfile,
  energyTargetKcal: number,
): Record<string, NutrientDri> {
  const bandKey = profile.sex ? bandFor(profile.sex, profile.birthdayAge) : null
  const table = bandKey ? DRI_TABLES[bandKey] : undefined
  if (!table) {
    throw new Error(
      `No DRI table for sex='${profile.sex}' age=${profile.birthdayAge}. ` +
        `Supported: adult female/male 31+ — add a band to DRI_TABLES (see dri.ts).`,
    )
  }

  const result: Record<string, NutrientDri> = { ...table }

  // Energy shows against the computed energy target, not a DRI constant.
  result.energy = {
    target: energyTargetKcal,
    targetType: 'computed',
    ul: null,
    ulScope: null,
  }

  // Protein override (owner intentionally eats above the RDA).
  if (profile.proteinTargetG != null) {
    result.protein = {
      target: profile.proteinTargetG,
      targetType: 'rda',
      ul: null,
      ulScope: null,
    }
  }

  // Energy-derived soft targets / guidance ceilings.
  for (const [key, cfg] of Object.entries(ENERGY_DERIVED)) {
    const grams = (cfg.pctEnergy * energyTargetKcal) / cfg.kcalPerGram
    result[key] = {
      target: grams,
      targetType: cfg.targetType,
      ul: cfg.firesRed ? grams : null,
      ulScope: cfg.firesRed ? 'guidance' : null,
    }
  }

  return result
}
