/**
 * Dietary Reference Intakes (DRI) lookup. Values are from the NASEM/IOM DRI tables (as
 * published by the NIH Office of Dietary Supplements): RDA where one exists, otherwise AI.
 *
 * ── SCOPE: owner's band only ─────────────────────────────────────────────────────────
 * Phase 1 is single-user, so only ADULT FEMALE 51–70 is populated (covers the owner's
 * current ages 51–53). The lookup is keyed by `${sex}:${ageBand}` so more bands are pure
 * data later. HOW TO ADD A BAND: add another entry to DRI_TABLES keyed e.g. 'male:31-50',
 * transcribe that band's RDA/AI + UL values, and extend `bandFor()` to map ages → band.
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

const DRI_TABLES: Record<string, Record<string, StaticDri>> = {
  'female:51-70': FEMALE_51_70,
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
  if (sex === 'female' && age >= 51 && age <= 70) return 'female:51-70'
  return null
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
        `Phase 1 supports adult female 51–70 only — add a band to DRI_TABLES (see dri.ts).`,
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
