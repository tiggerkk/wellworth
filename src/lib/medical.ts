/**
 * Medical module domain constants + the canonical lab-test reference list. UI-framework-free so
 * it's unit-tested and shared by the (M2) Entry form, Report detail, the (M3) importer, and the
 * (M4) Dashboard. DB access lives in `src/data/medical.ts` (M2); the typed Row/Insert/Update
 * aliases are added there once `database.ts` is regenerated from the applied migrations.
 *
 * MEDICAL_LAB_TESTS is the **source of truth** for the seed migration
 * (`supabase/migrations/12_medical_seed_lab_test.sql`). The seed mirrors this list
 * exactly; `medical.test.ts` cross-checks the two so they can't drift.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import { foldZh } from './zh-fold'

// DB row/insert/update aliases — the data layer (`src/data/medical.ts`) imports these (mirrors how
// `src/data/show.ts` imports its types from `src/lib/shows.ts`).
export type MedicalReportRow = Tables<'medical_report'>
export type MedicalReportInsert = TablesInsert<'medical_report'>
export type MedicalReportUpdate = TablesUpdate<'medical_report'>
export type MedicalResultRow = Tables<'medical_result'>
export type MedicalResultInsert = TablesInsert<'medical_result'>
export type MedicalResultUpdate = TablesUpdate<'medical_result'>
/** A result to persist; the save fills in `report_id` + `user_id`. */
export type MedicalResultInput = Omit<MedicalResultInsert, 'report_id' | 'user_id'>

// The CHECK-constrained enums come through the generated types as plain `string`; these unions +
// label maps are the front-end's narrowed view (mirrors the Shows/Books pattern).

/** Result categories in section display order (also the default Dashboard/Report section order). */
export const MEDICAL_CATEGORIES = [
  'general',
  'vitals',
  'lipids',
  'glucose',
  'liver',
  'renal',
  'electrolytes',
  'cbc',
  'thyroid',
  'bone',
  'tumour_markers',
  'hepatitis',
  'inflammation',
  'urine',
  'stool',
  'imaging',
  'eye',
  'other',
] as const
export type MedicalCategory = (typeof MEDICAL_CATEGORIES)[number]

export const MEDICAL_CATEGORY_LABELS: Record<MedicalCategory, string> = {
  general: 'General',
  vitals: 'Vitals',
  lipids: 'Lipids',
  glucose: 'Glucose',
  liver: 'Liver',
  renal: 'Renal',
  electrolytes: 'Electrolytes',
  cbc: 'Complete Blood Count',
  thyroid: 'Thyroid',
  bone: 'Bone',
  tumour_markers: 'Tumour Markers',
  hepatitis: 'Hepatitis',
  inflammation: 'Inflammation',
  urine: 'Urine',
  stool: 'Stool',
  imaging: 'Imaging',
  eye: 'Eye',
  other: 'Other',
}

export const REPORT_TYPES = [
  'health_screening',
  'mri',
  'ultrasound',
  'mammogram',
  'eye',
  'other',
] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  health_screening: 'Health Screening',
  mri: 'MRI',
  ultrasound: 'Ultrasound',
  mammogram: 'Mammogram',
  eye: 'Eye',
  other: 'Other',
}

/** A report only has a body part for these scan types. */
export function usesBodyPart(type: string): boolean {
  return (
    type === 'mri' || type === 'ultrasound' || type === 'mammogram' || type === 'other'
  )
}

// --- Reports-list view (search + filters + sort; pure — the screen holds the criteria state) ---

export type ReportSortField = 'date' | 'type' | 'provider' | 'bodyPart'
export type ReportSortDir = 'asc' | 'desc'

export interface ReportListCriteria {
  query: string
  reportType: 'all' | string
  provider: 'all' | string
  bodyPart: 'all' | string
  sortField: ReportSortField
  sortDir: ReportSortDir
}

export const DEFAULT_REPORT_LIST_CRITERIA: ReportListCriteria = {
  query: '',
  reportType: 'all',
  provider: 'all',
  bodyPart: 'all',
  sortField: 'date',
  sortDir: 'desc',
}

/** Sorted distinct providers across the reports (drives the Provider filter). */
export function reportProviders(reports: Pick<MedicalReportRow, 'provider'>[]): string[] {
  const set = new Set<string>()
  for (const r of reports) if (r.provider) set.add(r.provider)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Sorted distinct body parts across the reports (drives the Body Part filter). */
export function reportBodyParts(
  reports: Pick<MedicalReportRow, 'body_part'>[],
): string[] {
  const set = new Set<string>()
  for (const r of reports) if (r.body_part) set.add(r.body_part)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Folded text the Reports search matches: body part + narrative (Traditional⇄Simplified agnostic). */
export function reportSearchText(
  report: Pick<MedicalReportRow, 'body_part' | 'narrative'>,
): string {
  return foldZh([report.body_part, report.narrative].filter(Boolean).join(' '))
}

function reportSortKey(report: MedicalReportRow, field: ReportSortField): string | null {
  switch (field) {
    case 'date':
      return report.report_date
    case 'type':
      return report.report_type
    case 'provider':
      return report.provider
    case 'bodyPart':
      return report.body_part
  }
}

function compareReports(
  a: MedicalReportRow,
  b: MedicalReportRow,
  field: ReportSortField,
  dir: ReportSortDir,
): number {
  const ka = reportSortKey(a, field)
  const kb = reportSortKey(b, field)
  // Newest report first as the secondary order (and when a key is missing).
  const byDate = b.report_date.localeCompare(a.report_date)
  if (ka == null && kb == null) return byDate
  if (ka == null) return 1
  if (kb == null) return -1
  const primary = ka.localeCompare(kb)
  if (primary !== 0) return dir === 'asc' ? primary : -primary
  return byDate
}

/** Filter then sort the Reports list. Pure — does not mutate `reports`. */
export function applyReportView(
  reports: MedicalReportRow[],
  c: ReportListCriteria,
): MedicalReportRow[] {
  const q = foldZh(c.query.trim())
  return reports
    .filter((r) => {
      if (q && !reportSearchText(r).includes(q)) return false
      if (c.reportType !== 'all' && r.report_type !== c.reportType) return false
      if (c.provider !== 'all' && r.provider !== c.provider) return false
      if (c.bodyPart !== 'all' && r.body_part !== c.bodyPart) return false
      return true
    })
    .sort((a, b) => compareReports(a, b, c.sortField, c.sortDir))
}

export const MEDICAL_FLAGS = ['high', 'low', 'abnormal'] as const
export type MedicalFlag = (typeof MEDICAL_FLAGS)[number]

export const MEDICAL_FLAG_LABELS: Record<MedicalFlag, string> = {
  high: 'High',
  low: 'Low',
  abnormal: 'Abnormal',
}

/**
 * Flag → value colour (the report's own range drives the flag; the app never computes it). Uses
 * existing semantic tokens: high/abnormal = danger (red), low = info (distinct). The Dashboard/
 * Report detail (M4/M2) may refine `low` to a dedicated amber token.
 */
export const MEDICAL_FLAG_CLASS: Record<MedicalFlag, string> = {
  high: 'text-danger',
  low: 'text-info',
  abnormal: 'text-danger',
}

/**
 * Flag → a raw CSS colour var (same semantics as `MEDICAL_FLAG_CLASS`), for SVG strokes/dots on the
 * Dashboard where a Tailwind text class can't apply (sparkline end dot, recharts point).
 */
export const MEDICAL_FLAG_COLOR: Record<MedicalFlag, string> = {
  high: 'var(--color-danger)',
  low: 'var(--color-info)',
  abnormal: 'var(--color-danger)',
}

/** Whether a test records numbers, free text, or either depending on the lab/method. */
export const VALUE_KINDS = ['numeric', 'qualitative', 'either'] as const
export type ValueKind = (typeof VALUE_KINDS)[number]

/** A seeded reference test. `default_unit` is the canonical unit the importer normalizes to. */
export interface MedicalLabTestSeed {
  key: string
  display_name: string
  category: MedicalCategory
  default_unit: string | null
  value_kind: ValueKind
  default_tracked: boolean
  /** Order within the category; the seed migration uses the same value. */
  sort_order: number
}

/**
 * Canonical reference list, built from the owner's 2021–2026 reports across three providers
 * (MediFast HK, Mobile Medical HK, Global HealthCare Shanghai). Default units follow the consistent
 * HK convention where one exists (e.g. uric acid mmol/L, creatinine umol/L, haemoglobin g/dL).
 * `default_tracked` is the Dashboard starter set.
 */
export const MEDICAL_LAB_TESTS: MedicalLabTestSeed[] = [
  // ── general: BMI, body metrics, InBody body composition ──────────────────────────────
  t('bmi', 'BMI', 'general', null, 'numeric', true, 10),
  t('weight', 'Weight', 'general', 'kg', 'numeric', false, 20),
  t('height', 'Height', 'general', 'cm', 'numeric', false, 30),
  t('body_fat_pct', 'Body Fat %', 'general', '%', 'numeric', false, 40),
  t('body_fat_mass', 'Body Fat Mass', 'general', 'kg', 'numeric', false, 50),
  t(
    'skeletal_muscle_mass',
    'Skeletal Muscle Mass (SMM)',
    'general',
    'kg',
    'numeric',
    false,
    60,
  ),
  t('fat_free_mass', 'Fat-Free Mass', 'general', 'kg', 'numeric', false, 70),
  t('total_body_water', 'Total Body Water', 'general', 'L', 'numeric', false, 80),
  t('protein_mass', 'Protein (mass)', 'general', 'kg', 'numeric', false, 90),
  t('mineral_mass', 'Minerals (mass)', 'general', 'kg', 'numeric', false, 100),
  t('waist_hip_ratio', 'Waist–Hip Ratio', 'general', null, 'numeric', false, 110),
  t('visceral_fat_level', 'Visceral Fat Level', 'general', null, 'numeric', false, 120),
  t(
    'basal_metabolic_rate',
    'Basal Metabolic Rate',
    'general',
    'kcal',
    'numeric',
    false,
    130,
  ),
  t('obesity_degree', 'Obesity Degree', 'general', '%', 'numeric', false, 140),

  // ── vitals ───────────────────────────────────────────────────────────────────────────
  t(
    'blood_pressure_systolic',
    'Blood Pressure (Systolic)',
    'vitals',
    'mmHg',
    'numeric',
    true,
    10,
  ),
  t(
    'blood_pressure_diastolic',
    'Blood Pressure (Diastolic)',
    'vitals',
    'mmHg',
    'numeric',
    true,
    20,
  ),
  t('pulse', 'Pulse', 'vitals', '/min', 'numeric', false, 30),
  t('pulse_oximetry', 'Pulse Oximetry', 'vitals', '%', 'numeric', false, 40),
  t(
    'pulse_pressure_difference',
    'Pulse Pressure Difference',
    'vitals',
    'mmHg',
    'numeric',
    false,
    50,
  ),

  // ── lipids ─────────────────────────────────────────────────────────────────────────────
  t('total_cholesterol', 'Total Cholesterol', 'lipids', 'mmol/L', 'numeric', true, 10),
  t('ldl_cholesterol', 'LDL Cholesterol', 'lipids', 'mmol/L', 'numeric', true, 20),
  t('hdl_cholesterol', 'HDL Cholesterol', 'lipids', 'mmol/L', 'numeric', true, 30),
  t('triglycerides', 'Triglycerides', 'lipids', 'mmol/L', 'numeric', true, 40),
  t('vldl_cholesterol', 'VLDL Cholesterol', 'lipids', 'mmol/L', 'numeric', false, 50),
  t(
    'non_hdl_cholesterol',
    'Non-HDL Cholesterol',
    'lipids',
    'mmol/L',
    'numeric',
    false,
    60,
  ),
  t('total_lipid', 'Total Lipid', 'lipids', 'g/L', 'numeric', false, 70),
  t('lipoprotein_a', 'Lipoprotein(a)', 'lipids', 'mg/dL', 'numeric', false, 80),

  // ── glucose ──────────────────────────────────────────────────────────────────────────
  t('fasting_glucose', 'Fasting Blood Glucose', 'glucose', 'mmol/L', 'numeric', true, 10),
  t('hba1c', 'HbA1c', 'glucose', '%', 'numeric', true, 20),

  // ── liver ──────────────────────────────────────────────────────────────────────────────
  t('alt_sgpt', 'ALT (SGPT)', 'liver', 'U/L', 'numeric', true, 10),
  t('ast_sgot', 'AST (SGOT)', 'liver', 'U/L', 'numeric', true, 20),
  t('ast_alt_ratio', 'AST/ALT Ratio', 'liver', null, 'numeric', false, 30),
  t('alp', 'Alkaline Phosphatase (ALP)', 'liver', 'U/L', 'numeric', false, 40),
  t('ggt', 'Gamma-GT (GGT)', 'liver', 'U/L', 'numeric', false, 50),
  t('total_protein', 'Total Protein', 'liver', 'g/L', 'numeric', false, 60),
  t('albumin', 'Albumin', 'liver', 'g/L', 'numeric', false, 70),
  t('globulin', 'Globulin', 'liver', 'g/L', 'numeric', false, 80),
  t('ag_ratio', 'A/G Ratio', 'liver', null, 'numeric', false, 90),
  t('bilirubin_total', 'Bilirubin, Total', 'liver', 'umol/L', 'numeric', false, 100),
  t('bilirubin_direct', 'Bilirubin, Direct', 'liver', 'umol/L', 'numeric', false, 110),
  t(
    'bilirubin_indirect',
    'Bilirubin, Indirect',
    'liver',
    'umol/L',
    'numeric',
    false,
    120,
  ),

  // ── renal ──────────────────────────────────────────────────────────────────────────────
  t('creatinine', 'Creatinine', 'renal', 'umol/L', 'numeric', true, 10),
  t('urea', 'Urea (BUN)', 'renal', 'mmol/L', 'numeric', true, 20),
  t('uric_acid', 'Uric Acid', 'renal', 'mmol/L', 'numeric', true, 30),

  // ── electrolytes ───────────────────────────────────────────────────────────────────────
  t('sodium', 'Sodium', 'electrolytes', 'mmol/L', 'numeric', false, 10),
  t('potassium', 'Potassium', 'electrolytes', 'mmol/L', 'numeric', false, 20),
  t('chloride', 'Chloride', 'electrolytes', 'mmol/L', 'numeric', false, 30),
  t('bicarbonate', 'Bicarbonate', 'electrolytes', 'mmol/L', 'numeric', false, 40),
  t('calcium', 'Calcium', 'electrolytes', 'mmol/L', 'numeric', false, 50),
  t('phosphate', 'Phosphate', 'electrolytes', 'mmol/L', 'numeric', false, 60),
  t('magnesium', 'Magnesium', 'electrolytes', 'mmol/L', 'numeric', false, 70),

  // ── cbc ────────────────────────────────────────────────────────────────────────────────
  t('haemoglobin', 'Haemoglobin', 'cbc', 'g/dL', 'numeric', true, 10),
  t('haematocrit', 'Haematocrit', 'cbc', '%', 'numeric', false, 20),
  t('rbc', 'Red Blood Cells (RBC)', 'cbc', 'M/uL', 'numeric', false, 30),
  t('wbc', 'White Blood Cells (WBC)', 'cbc', 'K/uL', 'numeric', true, 40),
  t('platelet', 'Platelet', 'cbc', 'K/uL', 'numeric', true, 50),
  t('mcv', 'MCV', 'cbc', 'fL', 'numeric', false, 60),
  t('mch', 'MCH', 'cbc', 'pg', 'numeric', false, 70),
  t('mchc', 'MCHC', 'cbc', 'g/dL', 'numeric', false, 80),
  t('rdw', 'RDW', 'cbc', '%', 'numeric', false, 90),
  t('neutrophils_pct', 'Neutrophils %', 'cbc', '%', 'numeric', false, 100),
  t('lymphocytes_pct', 'Lymphocytes %', 'cbc', '%', 'numeric', false, 110),
  t('monocytes_pct', 'Monocytes %', 'cbc', '%', 'numeric', false, 120),
  t('eosinophils_pct', 'Eosinophils %', 'cbc', '%', 'numeric', false, 130),
  t('basophils_pct', 'Basophils %', 'cbc', '%', 'numeric', false, 140),
  t('neutrophils_abs', 'Neutrophils (absolute)', 'cbc', 'K/uL', 'numeric', false, 150),
  t('lymphocytes_abs', 'Lymphocytes (absolute)', 'cbc', 'K/uL', 'numeric', false, 160),
  t('monocytes_abs', 'Monocytes (absolute)', 'cbc', 'K/uL', 'numeric', false, 170),
  t('eosinophils_abs', 'Eosinophils (absolute)', 'cbc', 'K/uL', 'numeric', false, 180),
  t('basophils_abs', 'Basophils (absolute)', 'cbc', 'K/uL', 'numeric', false, 190),
  t('reticulocyte_count', 'Reticulocyte Count', 'cbc', '%', 'numeric', false, 200),
  t('blood_smear', 'Blood Smear', 'cbc', null, 'qualitative', false, 210),
  t('abo_grouping', 'ABO Grouping', 'cbc', null, 'qualitative', false, 220),
  t('rh_d_typing', 'Rh(D) Typing', 'cbc', null, 'qualitative', false, 230),

  // ── thyroid: free vs total are distinct analytes/units → separate keys ──────────────────
  t('tsh', 'TSH', 'thyroid', 'mIU/L', 'numeric', true, 10),
  t('t4_total', 'T4 (Total)', 'thyroid', 'nmol/L', 'numeric', false, 20),
  t('free_t4', 'Free T4 (FT4)', 'thyroid', 'pmol/L', 'numeric', false, 30),
  t('free_t3', 'Free T3 (FT3)', 'thyroid', 'pmol/L', 'numeric', false, 40),

  // ── bone ───────────────────────────────────────────────────────────────────────────────
  t('bone_t_score', 'Bone Density T-score', 'bone', null, 'numeric', true, 10),
  t('bone_z_score', 'Bone Density Z-score', 'bone', null, 'numeric', false, 20),
  t('speed_of_sound', 'Speed of Sound (SOS)', 'bone', 'm/s', 'numeric', false, 30),
  t(
    'bone_density_interpretation',
    'Bone Density Interpretation',
    'bone',
    null,
    'qualitative',
    false,
    40,
  ),
  t('vitamin_d_25oh', '25-OH Vitamin D', 'bone', 'ug/L', 'numeric', true, 50),

  // ── tumour_markers (CA markers canonical U/mL ≡ kU/L; CEA ng/mL ≡ µg/L) ─────────────────
  t('cea', 'CEA', 'tumour_markers', 'ng/mL', 'numeric', false, 10),
  t('afp', 'AFP', 'tumour_markers', 'ng/mL', 'numeric', false, 20),
  t('ca_125', 'CA 125', 'tumour_markers', 'U/mL', 'numeric', false, 30),
  t('ca_15_3', 'CA 15-3', 'tumour_markers', 'U/mL', 'numeric', false, 40),
  t('ca_19_9', 'CA 19-9', 'tumour_markers', 'U/mL', 'numeric', false, 50),

  // ── hepatitis ──────────────────────────────────────────────────────────────────────────
  t(
    'hbsag',
    'Hepatitis B Surface Antigen (HBsAg)',
    'hepatitis',
    null,
    'qualitative',
    false,
    10,
  ),
  t(
    'hbsab',
    'Hepatitis B Surface Antibody (HBsAb)',
    'hepatitis',
    'mIU/mL',
    'either',
    false,
    20,
  ),
  t(
    'anti_hav_igg',
    'Hepatitis A Antibody IgG (Anti-HAV)',
    'hepatitis',
    'mIU/mL',
    'either',
    false,
    30,
  ),
  t('hcv_antibody', 'Hepatitis C Antibody', 'hepatitis', 'COI', 'either', false, 40),

  // ── inflammation ───────────────────────────────────────────────────────────────────────
  t('esr', 'ESR', 'inflammation', 'mm/hr', 'numeric', false, 10),
  t('crp', 'C-Reactive Protein (CRP)', 'inflammation', 'mg/L', 'either', false, 20),
  t(
    'rheumatoid_factor',
    'Rheumatoid Factor',
    'inflammation',
    'IU/mL',
    'either',
    false,
    30,
  ),

  // ── urine: routine panel (mostly qualitative) ──────────────────────────────────────────
  t('urine_colour', 'Colour (Urine)', 'urine', null, 'qualitative', false, 10),
  t('urine_appearance', 'Appearance (Urine)', 'urine', null, 'qualitative', false, 20),
  t('urine_ph', 'pH (Urine)', 'urine', null, 'numeric', false, 30),
  t(
    'urine_specific_gravity',
    'Specific Gravity (Urine)',
    'urine',
    null,
    'numeric',
    false,
    40,
  ),
  t(
    'urine_albumin',
    'Albumin / Protein (Urine)',
    'urine',
    null,
    'qualitative',
    false,
    50,
  ),
  t('urine_sugar', 'Sugar / Glucose (Urine)', 'urine', null, 'qualitative', false, 60),
  t('urine_bilirubin', 'Bilirubin (Urine)', 'urine', null, 'qualitative', false, 70),
  t('urine_urobilinogen', 'Urobilinogen (Urine)', 'urine', 'umol/L', 'either', false, 80),
  t('urine_nitrate', 'Nitrite (Urine)', 'urine', null, 'qualitative', false, 90),
  t('urine_ketone', 'Ketone (Urine)', 'urine', null, 'qualitative', false, 100),
  t('urine_blood', 'Blood (Urine)', 'urine', null, 'qualitative', false, 110),
  t('urine_rbc', 'RBC (Urine)', 'urine', null, 'qualitative', false, 120),
  t('urine_wbc', 'WBC (Urine)', 'urine', null, 'qualitative', false, 130),
  t(
    'urine_epithelial',
    'Epithelial Cells (Urine)',
    'urine',
    null,
    'qualitative',
    false,
    140,
  ),
  t('urine_mucous', 'Mucous (Urine)', 'urine', null, 'qualitative', false, 150),
  t('urine_cast', 'Cast (Urine)', 'urine', null, 'qualitative', false, 160),
  t('urine_crystal', 'Crystal (Urine)', 'urine', null, 'qualitative', false, 170),
  t('urine_other', 'Other (Urine)', 'urine', null, 'qualitative', false, 180),

  // ── stool ──────────────────────────────────────────────────────────────────────────────
  t('stool_colour', 'Colour (Stool)', 'stool', null, 'qualitative', false, 10),
  t('stool_consistency', 'Consistency (Stool)', 'stool', null, 'qualitative', false, 20),
  t('stool_pus_cells', 'Pus Cells (Stool)', 'stool', '/HPF', 'qualitative', false, 30),
  t('stool_rbc', 'RBC (Stool)', 'stool', '/HPF', 'qualitative', false, 40),
  t('stool_wbc', 'WBC (Stool)', 'stool', '/HPF', 'qualitative', false, 50),
  t('stool_ova_cyst', 'Ova & Cyst (Stool)', 'stool', '/HPF', 'qualitative', false, 60),
  t('occult_blood', 'Occult Blood (Stool)', 'stool', null, 'qualitative', false, 70),

  // ── imaging: ECG numeric intervals + impression ────────────────────────────────────────
  t('ecg_heart_rate', 'Heart Rate (ECG)', 'imaging', '/min', 'numeric', false, 10),
  t('p_duration', 'P Duration', 'imaging', 'ms', 'numeric', false, 20),
  t('pq_interval', 'PQ Interval', 'imaging', 'ms', 'numeric', false, 30),
  t('qrs_duration', 'QRS Duration', 'imaging', 'ms', 'numeric', false, 40),
  t('qt_interval', 'QT Interval', 'imaging', 'ms', 'numeric', false, 50),
  t('qtc_interval', 'QTc Interval', 'imaging', 'ms', 'numeric', false, 60),
  t('p_axis', 'P Axis', 'imaging', 'deg', 'numeric', false, 70),
  t('qrs_axis', 'QRS Axis', 'imaging', 'deg', 'numeric', false, 80),
  t('ecg_finding', 'ECG Finding', 'imaging', null, 'qualitative', false, 90),

  // ── eye: structured refraction (Sphere/Cylinder/Addition × OD/OS) + IOP ────────────────
  t('sphere_od', 'Sphere (OD)', 'eye', 'D', 'numeric', false, 10),
  t('cylinder_od', 'Cylinder (OD)', 'eye', 'D', 'numeric', false, 20),
  t('addition_od', 'Addition (OD)', 'eye', 'D', 'numeric', false, 30),
  t('sphere_os', 'Sphere (OS)', 'eye', 'D', 'numeric', false, 40),
  t('cylinder_os', 'Cylinder (OS)', 'eye', 'D', 'numeric', false, 50),
  t('addition_os', 'Addition (OS)', 'eye', 'D', 'numeric', false, 60),
  t('iop', 'Intraocular Pressure (IOP)', 'eye', 'mmHg', 'numeric', false, 70),

  // ── other: catch-all biochem / cardiac / markers / device output ───────────────────────
  t('cpk_total', 'CPK, Total', 'other', 'U/L', 'numeric', false, 10),
  t('ck_mb', 'CK-MB', 'other', 'ng/mL', 'numeric', false, 20),
  t('myoglobin', 'Myoglobin', 'other', 'ng/mL', 'numeric', false, 30),
  t(
    'hs_ctnl',
    'High-sensitivity Troponin (hs-cTnI)',
    'other',
    'pg/mL',
    'either',
    false,
    40,
  ),
  t('ldh', 'LDH', 'other', 'U/L', 'numeric', false, 50),
  t('amylase', 'Amylase', 'other', 'U/L', 'numeric', false, 60),
  t('lipase', 'Lipase', 'other', 'U/L', 'numeric', false, 70),
  t('iron', 'Iron', 'other', 'umol/L', 'numeric', false, 80),
  t('h_pylori_ab', 'H. pylori Antibody', 'other', 'U/mL', 'either', false, 90),
  t(
    'h_pylori_breath_test',
    'H. pylori C-13 Breath Test',
    'other',
    null,
    'either',
    false,
    100,
  ),
  t('position_head', 'Radiation Scan — Head', 'other', 'uSv/Hour', 'numeric', false, 110),
  t('position_neck', 'Radiation Scan — Neck', 'other', 'uSv/Hour', 'numeric', false, 120),
  t('position_arm', 'Radiation Scan — Arm', 'other', 'uSv/Hour', 'numeric', false, 130),
  t('position_back', 'Radiation Scan — Back', 'other', 'uSv/Hour', 'numeric', false, 140),
  t('position_leg', 'Radiation Scan — Leg', 'other', 'uSv/Hour', 'numeric', false, 150),
]

/** Keys flagged default_tracked — seeds a new profile's medical_tracked_tests. */
export function defaultTrackedTestKeys(): string[] {
  return MEDICAL_LAB_TESTS.filter((x) => x.default_tracked).map((x) => x.key)
}

/**
 * The six structured eye-refraction result keys (M7), laid out as the Add/Edit form grid renders them:
 * a row per eye (OD/OS) × Sphere / Cylinder / Addition. They are ordinary `eye`-category numeric
 * `medical_result` rows (so they trend like any measurement); the form just gives them a dedicated grid
 * instead of the generic test picker.
 */
export const EYE_REFRACTION_ROWS: { eye: string; label: string; keys: string[] }[] = [
  { eye: 'OD', label: 'Right (OD)', keys: ['sphere_od', 'cylinder_od', 'addition_od'] },
  { eye: 'OS', label: 'Left (OS)', keys: ['sphere_os', 'cylinder_os', 'addition_os'] },
]

/** Column headers for the refraction grid (one numeric value per eye). */
export const EYE_REFRACTION_COLUMNS = ['Sphere', 'Cylinder', 'Addition'] as const

/** Flat set of the six refraction keys, for hiding them from the generic results list on eye reports. */
export const EYE_REFRACTION_KEYS: string[] = EYE_REFRACTION_ROWS.flatMap((r) => r.keys)

/** Reference test by key (the static seed mirror is the runtime reference — no DB round-trip). */
export const labTestByKey: Map<string, MedicalLabTestSeed> = new Map(
  MEDICAL_LAB_TESTS.map((t) => [t.key, t]),
)

/** The reference tests grouped by category, in section + sort order (for the test picker). */
export function medicalTestsByCategory(): {
  category: MedicalCategory
  tests: MedicalLabTestSeed[]
}[] {
  return MEDICAL_CATEGORIES.map((category) => ({
    category,
    tests: MEDICAL_LAB_TESTS.filter((t) => t.category === category).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  })).filter((g) => g.tests.length > 0)
}

const CATEGORY_INDEX = new Map<string, number>(MEDICAL_CATEGORIES.map((c, i) => [c, i]))

/**
 * Stable display order for a report's results: by category section order, then the test's seeded
 * `sort_order`; ad-hoc/unknown tests (`test_key` null or not in the reference) sort last within their
 * category, then by name. `sectionOrder`/`testOrder` are the profile overrides (M5) — when omitted,
 * the seeded order is used. Pure; does not mutate the input.
 */
export function orderResultsForDisplay<
  T extends { category: string; test_key: string | null; test_name: string },
>(results: T[], sectionOrder?: string[] | null, testOrder?: string[] | null): T[] {
  const catRank = sectionOrder?.length
    ? new Map(sectionOrder.map((c, i) => [c, i]))
    : CATEGORY_INDEX
  const testRank = testOrder?.length ? new Map(testOrder.map((k, i) => [k, i])) : null
  const LAST = Number.MAX_SAFE_INTEGER
  const catOf = (c: string) => catRank.get(c) ?? LAST
  const testOf = (r: T) => {
    if (testRank) return r.test_key ? (testRank.get(r.test_key) ?? LAST) : LAST
    const seed = r.test_key ? labTestByKey.get(r.test_key) : undefined
    return seed ? seed.sort_order : LAST
  }
  return [...results].sort(
    (a, b) =>
      catOf(a.category) - catOf(b.category) ||
      testOf(a) - testOf(b) ||
      a.test_name.localeCompare(b.test_name),
  )
}

/**
 * Why an imported result is flagged for review (the "uncertain" lifecycle). Derived from row state so
 * it works identically on a parsed/draft row and a saved DB row (no persisted reason). The importer
 * raises `uncertain` from the AI file flag OR an app-side rule (numeric test with no number read, or a
 * name that matched no reference test); this turns the flag into a short reason for the
 * `Review – <reason>` marker. Returns null when the row isn't flagged.
 */
export function medicalReviewReason(args: {
  uncertain: boolean
  testKey: string | null
  hasNumericValue: boolean
}): string | null {
  if (!args.uncertain) return null
  const numeric = args.testKey
    ? labTestByKey.get(args.testKey)?.value_kind === 'numeric'
    : false
  if (numeric && !args.hasNumericValue) return 'no numeric value'
  if (args.testKey == null) return 'unmatched test'
  return 'check value'
}

/** Optional Add/Edit-Report parent fields, gated by `profile.medical_visible_fields`. */
export const MEDICAL_REPORT_FIELDS: { key: string; label: string }[] = [
  { key: 'provider', label: 'Provider' },
  { key: 'body_part', label: 'Body Part' },
  { key: 'narrative', label: 'Narrative' },
  { key: 'document_urls', label: 'Document Links' },
]

/** NULL = all fields visible (default-on); an explicit array is the trimmed set. Mirrors Shows. */
export function isMedicalFieldVisible(
  visibleFields: string[] | null | undefined,
  key: string,
): boolean {
  return visibleFields == null || visibleFields.includes(key)
}

/** A result's display value: the qualitative text if present, else the (normalized) number, else "—". */
export function formatResultValue(r: {
  value_text: string | null
  value_num: number | null
}): string {
  if (r.value_text != null && r.value_text.trim() !== '') return r.value_text
  if (r.value_num != null) return String(r.value_num)
  return '—'
}

/** A result's reference range for display: the printed text if present, else the numeric span. */
export function formatRefRange(r: {
  ref_text: string | null
  ref_low: number | null
  ref_high: number | null
}): string {
  if (r.ref_text != null && r.ref_text.trim() !== '') return r.ref_text
  if (r.ref_low != null && r.ref_high != null) return `${r.ref_low}–${r.ref_high}`
  if (r.ref_low != null) return `≥ ${r.ref_low}`
  if (r.ref_high != null) return `≤ ${r.ref_high}`
  return ''
}

/** Terse row builder so the list above reads as a table. */
function t(
  key: string,
  display_name: string,
  category: MedicalCategory,
  default_unit: string | null,
  value_kind: ValueKind,
  default_tracked: boolean,
  sort_order: number,
): MedicalLabTestSeed {
  return {
    key,
    display_name,
    category,
    default_unit,
    value_kind,
    default_tracked,
    sort_order,
  }
}
