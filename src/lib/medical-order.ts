/**
 * Medical display-order helpers (M5) — pure, unit-tested. Turn the profile's
 * `medical_section_order` / `medical_test_order` overrides into complete, valid orderings for the
 * reorder editor, and flatten the editor's per-category test lists back into the stored flat array.
 *
 * The overrides are **partial-tolerant**: an override may be stale (a removed test key) or incomplete
 * (a test added to the seed after the override was saved). These helpers always return every current
 * category / test exactly once — override entries first (in their saved order), then anything missing
 * appended in the canonical seeded order — so the editor never drops or duplicates a row. `orderResults
 * ForDisplay` (in `medical.ts`) is separately tolerant for the read path.
 */
import {
  labTestByKey,
  MEDICAL_CATEGORIES,
  MEDICAL_LAB_TESTS,
  type MedicalCategory,
} from './medical'

/** Categories in the user's order: valid override entries (de-duped) then any missing, canonical. */
export function effectiveSectionOrder(
  override: string[] | null | undefined,
): MedicalCategory[] {
  const valid = new Set<string>(MEDICAL_CATEGORIES)
  const seen = new Set<string>()
  const out: MedicalCategory[] = []
  for (const c of override ?? []) {
    if (valid.has(c) && !seen.has(c)) {
      out.push(c as MedicalCategory)
      seen.add(c)
    }
  }
  for (const c of MEDICAL_CATEGORIES) if (!seen.has(c)) out.push(c)
  return out
}

/** The seeded test keys of one category, in `sort_order`. */
function seededTestKeys(category: MedicalCategory): string[] {
  return MEDICAL_LAB_TESTS.filter((t) => t.category === category)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => t.key)
}

/**
 * Test keys of one category in the user's order: the flat `medical_test_order` entries that belong to
 * this category (in their saved order), then any of the category's seeded tests not yet listed.
 */
export function effectiveTestOrderForCategory(
  category: MedicalCategory,
  override: string[] | null | undefined,
): string[] {
  const seeded = seededTestKeys(category)
  const inCategory = new Set(seeded)
  const seen = new Set<string>()
  const out: string[] = []
  for (const k of override ?? []) {
    if (inCategory.has(k) && !seen.has(k)) {
      out.push(k)
      seen.add(k)
    }
  }
  for (const k of seeded) if (!seen.has(k)) out.push(k)
  return out
}

/** Build the editor model: section order + each category's ordered test keys. */
export function buildOrderModel(
  sectionOverride: string[] | null | undefined,
  testOverride: string[] | null | undefined,
): { sectionOrder: MedicalCategory[]; testsByCategory: Record<string, string[]> } {
  const sectionOrder = effectiveSectionOrder(sectionOverride)
  const testsByCategory: Record<string, string[]> = {}
  for (const c of MEDICAL_CATEGORIES) {
    testsByCategory[c] = effectiveTestOrderForCategory(c, testOverride)
  }
  return { sectionOrder, testsByCategory }
}

/** Flatten the per-category test orders into the stored flat `medical_test_order`, in section order. */
export function flattenTestOrder(
  sectionOrder: MedicalCategory[],
  testsByCategory: Record<string, string[]>,
): string[] {
  return sectionOrder.flatMap((c) => testsByCategory[c] ?? [])
}

/** A test's display name for the reorder rows (canonical seed name; key fallback for safety). */
export function testDisplayName(key: string): string {
  return labTestByKey.get(key)?.display_name ?? key
}
