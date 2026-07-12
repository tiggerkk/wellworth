/**
 * Structured-import parsing for the Medical module (docs/02-tech-spec.md → Medical). Pure: no I/O.
 * Accepts **JSON** (primary; shape = `templates/medical-import.schema.json`) or **CSV** (same fields),
 * applies a **tolerant JSON repair** for the observed AI glitch (a stray quote after a number, e.g.
 * `8.6"`), validates the enums (with safe fallbacks), **matches each result to a `test_key`** (an
 * alnum name index over `MEDICAL_LAB_TESTS` + a curated provider-alias map, CJK stripped), and
 * **normalizes units** to each test's canonical unit (`medical-units.ts`). The review screen
 * (`ImportMedicalSheet`) shows the result for confirmation before an idempotent save.
 */
import { parseCsv } from './csv'
import {
  MEDICAL_CATEGORIES,
  MEDICAL_FLAGS,
  MEDICAL_LAB_TESTS,
  REPORT_TYPES,
  type MedicalCategory,
  type MedicalFlag,
  type ReportType,
} from '../constants/medical'
import { labTestByKey } from './medical'
import { normalizeResult } from './medical-units'

export interface ParsedResult {
  test_key: string | null
  test_name: string
  /** display_name of the matched reference test (null = ad-hoc / unmatched), for the review UI. */
  matched_name: string | null
  category: MedicalCategory
  value_num: number | null
  value_text: string | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  ref_text: string | null
  flag: MedicalFlag | null
  uncertain: boolean
  normalized: boolean
  value_num_original: number | null
  unit_original: string | null
}

export interface ParsedReport {
  report_date: string | null
  report_type: ReportType
  provider: string | null
  body_part: string | null
  narrative: string | null
  results: ParsedResult[]
}

export type ParseResult =
  | { ok: true; report: ParsedReport; warnings: string[] }
  | { ok: false; error: string }

// ── tolerant JSON repair ────────────────────────────────────────────────────────────────

/**
 * Auto-fix the observed AI-formatting glitch before `JSON.parse`: a stray closing quote after a
 * numeric value, e.g. `"ref_high": 8.6",` → `"ref_high": 8.6,`. The lookahead requires the quote to
 * sit at a value position (before a comma / brace / bracket / newline) so it never touches a real
 * string like `"unit": "U/L"`.
 */
export function repairMedicalJson(raw: string): string {
  return raw.replace(/(:\s*-?\d+(?:\.\d+)?)"(?=\s*[,}\]\r\n])/g, '$1')
}

/** Last-ditch repair: insert a missing comma between a value and the next `"key"` on a new line. */
function insertMissingCommas(s: string): string {
  return s.replace(/(["\d\]}])(\s*\r?\n\s*)(")/g, '$1,$2$3')
}

function jsonError(text: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const m = /position (\d+)/.exec(msg)
  if (m) {
    const pos = Number(m[1])
    const before = text.slice(0, pos)
    const line = before.split('\n').length
    const col = pos - before.lastIndexOf('\n')
    return `Couldn’t parse the JSON (line ${line}, column ${col}). Check for a missing comma or a stray quote near there.`
  }
  return `Couldn’t parse the JSON: ${msg}`
}

// ── enum / value coercion ───────────────────────────────────────────────────────────────

const REPORT_TYPE_SET = new Set<string>(REPORT_TYPES)
const CATEGORY_SET = new Set<string>(MEDICAL_CATEGORIES)
const FLAG_SET = new Set<string>(MEDICAL_FLAGS)

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s === '' ? null : s
}
function numOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}
function asDate(v: unknown): string | null {
  const s = strOrNull(v)
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}
function asReportType(v: unknown): ReportType {
  const s = strOrNull(v)
  return s && REPORT_TYPE_SET.has(s) ? (s as ReportType) : 'other'
}
function asCategory(v: unknown): MedicalCategory {
  const s = strOrNull(v)
  return s && CATEGORY_SET.has(s) ? (s as MedicalCategory) : 'other'
}
function asFlag(v: unknown): MedicalFlag | null {
  const s = strOrNull(v)
  return s && FLAG_SET.has(s) ? (s as MedicalFlag) : null
}

// ── test-key matching ───────────────────────────────────────────────────────────────────

/** Comparison key: strip CJK/fullwidth, map %→pct and #→abs (keep the differential signal), keep a-z0-9. */
function alnum(s: string): string {
  let out = ''
  for (const ch of s.toLowerCase()) {
    // Bilingual names are "English 中文"; stop at the first CJK/fullwidth char so a Chinese suffix
    // that ends in digits/latin (e.g. "CA 125 腫瘤指標125") can't corrupt the key. Use the English head.
    if ((ch.codePointAt(0) ?? 0) >= 0x2e80) break
    if (ch === '%') out += 'pct'
    else if (ch === '#') out += 'abs'
    else if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) out += ch
  }
  return out
}

// Curated variants the display-name index alone won't catch (abbreviations + provider spellings).
// Global = unambiguous across categories; category-scoped resolves names that collide (urine/stool/
// general "Albumin"/"Protein"/"Glucose"/"RBC"…).
const GLOBAL_ALIASES: Record<string, string> = {
  alp: 'alp',
  alkalinephosphatase: 'alp',
  ggt: 'ggt',
  gammagt: 'ggt',
  gammaglutamyltranspeptidase: 'ggt',
  ag: 'ag_ratio',
  astalt: 'ast_alt_ratio',
  glob: 'globulin',
  sgpt: 'alt_sgpt',
  alt: 'alt_sgpt',
  sgot: 'ast_sgot',
  ast: 'ast_sgot',
  totalbilirubin: 'bilirubin_total',
  directbilirubin: 'bilirubin_direct',
  indirectbilirubin: 'bilirubin_indirect',
  ibil: 'bilirubin_indirect',
  agratio: 'ag_ratio',
  urea: 'urea',
  ureabun: 'urea',
  bloodureanitrogen: 'urea',
  bun: 'urea',
  sodiumna: 'sodium',
  potassiumk: 'potassium',
  chloridecl: 'chloride',
  co2combiningpower: 'bicarbonate',
  phosphorus: 'phosphate',
  phosphorusinorganic: 'phosphate',
  cholesteroltotal: 'total_cholesterol',
  ldldirect: 'ldl_cholesterol',
  lowdensitylipoproteinldl: 'ldl_cholesterol',
  ldl: 'ldl_cholesterol',
  highdensitylipoproteinhdl: 'hdl_cholesterol',
  hdl: 'hdl_cholesterol',
  triglyceride: 'triglycerides',
  glucose: 'fasting_glucose',
  glucosefasting: 'fasting_glucose',
  fastingbloodglucose: 'fasting_glucose',
  glucose0h: 'fasting_glucose',
  hemoglobina1c: 'hba1c',
  haemoglobina1c: 'hba1c',
  t4: 't4_total',
  thyroxinet4: 't4_total',
  thyroxinet4total: 't4_total',
  freet4: 'free_t4',
  ft4: 'free_t4',
  freet3: 'free_t3',
  ft3: 'free_t3',
  hemoglobin: 'haemoglobin',
  hematocrit: 'haematocrit',
  hematocritpcv: 'haematocrit',
  haematocritpcv: 'haematocrit',
  hematocritpct: 'haematocrit',
  haematocritpct: 'haematocrit',
  pcv: 'haematocrit',
  redbloodcells: 'rbc',
  whitebloodcells: 'wbc',
  platelets: 'platelet',
  rdwcv: 'rdw',
  rdwpct: 'rdw',
  // differential percentages — plural + singular provider spellings ("Neutrophil %" → neutrophilpct)
  neutrophils: 'neutrophils_pct',
  neutrophil: 'neutrophils_pct',
  neutrophilspct: 'neutrophils_pct',
  neutrophilpct: 'neutrophils_pct',
  lymphocytes: 'lymphocytes_pct',
  lymphocyte: 'lymphocytes_pct',
  lymphocytespct: 'lymphocytes_pct',
  lymphocytepct: 'lymphocytes_pct',
  monocytes: 'monocytes_pct',
  monocyte: 'monocytes_pct',
  monocytespct: 'monocytes_pct',
  monocytepct: 'monocytes_pct',
  eosinophils: 'eosinophils_pct',
  eosinophil: 'eosinophils_pct',
  eosinophilspct: 'eosinophils_pct',
  eosinophilpct: 'eosinophils_pct',
  basophils: 'basophils_pct',
  basophil: 'basophils_pct',
  basophilspct: 'basophils_pct',
  basophilpct: 'basophils_pct',
  neutrophilsabsolute: 'neutrophils_abs',
  lymphocytesabsolute: 'lymphocytes_abs',
  monocytesabsolute: 'monocytes_abs',
  eosinophilsabsolute: 'eosinophils_abs',
  basophilsabsolute: 'basophils_abs',
  // "<cell> #" → "<cell>abs" (alnum maps # → abs); both plural and singular provider spellings
  neutrophilsabs: 'neutrophils_abs',
  neutrophilabs: 'neutrophils_abs',
  lymphocytesabs: 'lymphocytes_abs',
  lymphocyteabs: 'lymphocytes_abs',
  monocytesabs: 'monocytes_abs',
  monocyteabs: 'monocytes_abs',
  eosinophilsabs: 'eosinophils_abs',
  eosinophilabs: 'eosinophils_abs',
  basophilsabs: 'basophils_abs',
  basophilabs: 'basophils_abs',
  rhdtyping: 'rh_d_typing',
  hbsag: 'hbsag',
  hbsab: 'hbsab',
  hepatitisbsurfaceantigen: 'hbsag',
  hepatitisbsurfaceantibody: 'hbsab',
  hepatitisavirusantibodyigg: 'anti_hav_igg',
  hepatitisavirusiggantibody: 'anti_hav_igg',
  hepatitisaigg: 'anti_hav_igg',
  hepatitiscantibody: 'hcv_antibody',
  hepatitiscvirusantibody: 'hcv_antibody',
  erythrocytessedimentationrate: 'esr',
  creactiveprotein: 'crp',
  highsensitivitycrp: 'crp',
  highsensitivitycreactiveprotein: 'crp',
  rafactor: 'rheumatoid_factor',
  rheumatoidfactorquantitative: 'rheumatoid_factor',
  rheumatoidfactorquantitativetest: 'rheumatoid_factor',
  carcinoembryonicantigen: 'cea',
  alphafetoprotein: 'afp',
  tscore: 'bone_t_score',
  zscore: 'bone_z_score',
  speedofsound: 'speed_of_sound',
  sos: 'speed_of_sound',
  '25ohd': 'vitamin_d_25oh',
  '25hydroxyvitamind': 'vitamin_d_25oh',
  '25ohvitamind': 'vitamin_d_25oh',
  vitamind: 'vitamin_d_25oh',
  bodymassindex: 'bmi',
  weightinbody: 'weight',
  percentbodyfat: 'body_fat_pct',
  percentbodyfatpbf: 'body_fat_pct',
  pbf: 'body_fat_pct',
  smm: 'skeletal_muscle_mass',
  skeletalmusclemass: 'skeletal_muscle_mass',
  systolicpressure: 'blood_pressure_systolic',
  diastolicpressure: 'blood_pressure_diastolic',
  cpk: 'cpk_total',
  hsctnl: 'hs_ctnl',
  hsctni: 'hs_ctnl',
  highsensitivitytroponin: 'hs_ctnl',
  hpyloriab: 'h_pylori_ab',
  hpyloriantibody: 'h_pylori_ab',
  c13ureabreathtest: 'h_pylori_breath_test',
  ureabreathtest: 'h_pylori_breath_test',
  testc13: 'h_pylori_breath_test',
  heartrate: 'ecg_heart_rate',
  positionhead: 'position_head',
  positionneck: 'position_neck',
  positionarm: 'position_arm',
  positionback: 'position_back',
  positionleg: 'position_leg',
}

const CATEGORY_ALIASES: Record<string, string> = {
  // urine routine — names collide with liver/cbc/glucose, so scope by category
  'urine:albumin': 'urine_albumin',
  'urine:protein': 'urine_albumin',
  'urine:sugar': 'urine_sugar',
  'urine:glucose': 'urine_sugar',
  'urine:glucoseurine': 'urine_sugar',
  'urine:bilirubin': 'urine_bilirubin',
  'urine:urobilinogen': 'urine_urobilinogen',
  'urine:nitrate': 'urine_nitrate',
  'urine:nitrates': 'urine_nitrate',
  'urine:nitrite': 'urine_nitrate',
  'urine:ketone': 'urine_ketone',
  'urine:ketones': 'urine_ketone',
  'urine:blood': 'urine_blood',
  'urine:colour': 'urine_colour',
  'urine:color': 'urine_colour',
  'urine:appearance': 'urine_appearance',
  'urine:clarity': 'urine_appearance',
  'urine:ph': 'urine_ph',
  'urine:reaction': 'urine_ph',
  'urine:specificgravity': 'urine_specific_gravity',
  'urine:rbc': 'urine_rbc',
  'urine:redbloodcells': 'urine_rbc',
  'urine:wbc': 'urine_wbc',
  'urine:whitebloodcells': 'urine_wbc',
  'urine:epithelialcell': 'urine_epithelial',
  'urine:epithelialcells': 'urine_epithelial',
  'urine:mucous': 'urine_mucous',
  'urine:cast': 'urine_cast',
  'urine:crystal': 'urine_crystal',
  'urine:other': 'urine_other',
  'urine:others': 'urine_other',
  'urine:redbloodcellsurinequalitative': 'urine_rbc',
  'urine:whitebloodcellsurinequalitative': 'urine_wbc',
  'urine:redbloodcellsmicroscopic': 'urine_rbc',
  'urine:whitebloodcellsmicroscopic': 'urine_wbc',
  // stool — bare and "Stool …"-prefixed spellings
  'stool:colour': 'stool_colour',
  'stool:color': 'stool_colour',
  'stool:colourstool': 'stool_colour',
  'stool:colorstool': 'stool_colour',
  'stool:stoolcolour': 'stool_colour',
  'stool:stoolcolor': 'stool_colour',
  'stool:consistency': 'stool_consistency',
  'stool:stoolconsistency': 'stool_consistency',
  'stool:puscells': 'stool_pus_cells',
  'stool:stoolpuscells': 'stool_pus_cells',
  'stool:rbc': 'stool_rbc',
  'stool:stoolrbc': 'stool_rbc',
  'stool:wbc': 'stool_wbc',
  'stool:stoolwbc': 'stool_wbc',
  'stool:ovacyst': 'stool_ova_cyst',
  'stool:ovaandcyst': 'stool_ova_cyst',
  'stool:stoolovacyst': 'stool_ova_cyst',
  'stool:stoolovaandcyst': 'stool_ova_cyst',
  'stool:occultblood': 'occult_blood',
  // general body-composition collisions
  'general:protein': 'protein_mass',
  'general:minerals': 'mineral_mass',
  // cbc abbreviations (the bare "WBC"/"RBC" the HK reports print)
  'cbc:wbc': 'wbc',
  'cbc:rbc': 'rbc',
}

// Build the indices once.
const CAT_INDEX = new Map<string, string>()
const GLOBAL_INDEX = new Map<string, string>()
const GLOBAL_DUP = new Set<string>()
for (const t of MEDICAL_LAB_TESTS) {
  const a = alnum(t.display_name)
  CAT_INDEX.set(`${t.category}:${a}`, t.key)
  if (GLOBAL_INDEX.has(a)) GLOBAL_DUP.add(a)
  else GLOBAL_INDEX.set(a, t.key)
}
for (const dup of GLOBAL_DUP) GLOBAL_INDEX.delete(dup) // ambiguous display names resolve via category only
for (const [a, key] of Object.entries(GLOBAL_ALIASES)) GLOBAL_INDEX.set(a, key)
for (const [k, key] of Object.entries(CATEGORY_ALIASES)) CAT_INDEX.set(k, key)

/** Match a printed (possibly bilingual) test name to a reference `test_key`, or null if ad-hoc. */
export function matchTestKey(testName: string, category: MedicalCategory): string | null {
  const a = alnum(testName)
  if (!a) return null
  return CAT_INDEX.get(`${category}:${a}`) ?? GLOBAL_INDEX.get(a) ?? null
}

// ── result/report assembly ──────────────────────────────────────────────────────────────

function makeResult(input: {
  test_name: string
  declaredCategory: MedicalCategory
  value_num: number | null
  value_text: string | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  ref_text: string | null
  flag: MedicalFlag | null
  uncertain: boolean
}): ParsedResult {
  const test_key = matchTestKey(input.test_name, input.declaredCategory)
  const seed = test_key ? labTestByKey.get(test_key) : undefined
  const category = seed ? seed.category : input.declaredCategory
  const norm = normalizeResult({
    value_num: input.value_num,
    unit: input.unit,
    ref_low: input.ref_low,
    ref_high: input.ref_high,
    test_key,
  })
  // Flag for review (the "uncertain" lifecycle) from the AI file flag OR an app-side rule: a numeric
  // test that imported with no number read, or a name that matched no reference test. Reviewing the
  // row (edit or "Mark Reviewed") clears it; see `medicalReviewReason`.
  const appReview =
    (seed?.value_kind === 'numeric' && norm.value_num == null) || test_key == null
  return {
    test_key,
    test_name: input.test_name,
    matched_name: seed?.display_name ?? null,
    category,
    value_num: norm.value_num,
    value_text: input.value_text,
    unit: norm.unit,
    ref_low: norm.ref_low,
    ref_high: norm.ref_high,
    ref_text: input.ref_text,
    flag: input.flag,
    uncertain: input.uncertain || appReview,
    normalized: norm.normalized,
    value_num_original: norm.value_num_original,
    unit_original: norm.unit_original,
  }
}

function buildFromObject(obj: unknown): ParseResult {
  if (typeof obj !== 'object' || obj === null) {
    return { ok: false, error: 'The file isn’t a JSON object.' }
  }
  const o = obj as Record<string, unknown>
  if (!Array.isArray(o.results)) {
    return { ok: false, error: 'The JSON has no "results" array.' }
  }
  const warnings: string[] = []
  const results: ParsedResult[] = []
  o.results.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) {
      warnings.push(`Result ${i + 1} skipped (not an object).`)
      return
    }
    const r = raw as Record<string, unknown>
    const test_name = strOrNull(r.test_name)
    if (!test_name) {
      warnings.push(`Result ${i + 1} skipped (missing test_name).`)
      return
    }
    results.push(
      makeResult({
        test_name,
        declaredCategory: asCategory(r.category),
        value_num: numOrNull(r.value_num),
        value_text: strOrNull(r.value_text),
        unit: strOrNull(r.unit),
        ref_low: numOrNull(r.ref_low),
        ref_high: numOrNull(r.ref_high),
        ref_text: strOrNull(r.ref_text),
        flag: asFlag(r.flag),
        uncertain: r.uncertain === true,
      }),
    )
  })
  return {
    ok: true,
    warnings,
    report: {
      report_date: asDate(o.report_date),
      report_type: asReportType(o.report_type),
      provider: strOrNull(o.provider),
      body_part: strOrNull(o.body_part),
      narrative: strOrNull(o.narrative),
      results,
    },
  }
}

/** Parse a JSON import (with tolerant repair). */
export function parseMedicalJson(raw: string): ParseResult {
  const repaired = repairMedicalJson(raw)
  let obj: unknown
  try {
    obj = JSON.parse(repaired)
  } catch {
    try {
      obj = JSON.parse(insertMissingCommas(repaired))
    } catch (e) {
      return { ok: false, error: jsonError(repaired, e) }
    }
  }
  return buildFromObject(obj)
}

/** Parse a CSV import (rows from `parseCsv`). Report-level fields are read from the first data row. */
export function parseMedicalCsv(rows: string[][]): ParseResult {
  if (rows.length < 2) return { ok: false, error: 'The CSV has no data rows.' }
  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)
  if (idx('test_name') < 0 || idx('category') < 0) {
    return { ok: false, error: 'Missing required column(s): test_name, category.' }
  }
  const col = (cells: string[], name: string) => {
    const i = idx(name)
    return i >= 0 ? (cells[i] ?? '').trim() : ''
  }
  const dataRows = rows.slice(1).filter((c) => c.some((x) => x.trim() !== ''))
  if (dataRows.length === 0) return { ok: false, error: 'The CSV has no data rows.' }
  const first = dataRows[0]!
  const warnings: string[] = []
  const results: ParsedResult[] = []
  dataRows.forEach((cells, i) => {
    const test_name = col(cells, 'test_name')
    if (!test_name) {
      warnings.push(`Row ${i + 2} skipped (missing test_name).`)
      return
    }
    const s = (name: string) => strOrNull(col(cells, name))
    const n = (name: string) => numOrNull(col(cells, name))
    const uncertainCell = col(cells, 'uncertain').toLowerCase()
    results.push(
      makeResult({
        test_name,
        declaredCategory: asCategory(col(cells, 'category')),
        value_num: n('value_num'),
        value_text: s('value_text'),
        unit: s('unit'),
        ref_low: n('ref_low'),
        ref_high: n('ref_high'),
        ref_text: s('ref_text'),
        flag: asFlag(col(cells, 'flag')),
        uncertain:
          uncertainCell === 'true' || uncertainCell === '1' || uncertainCell === 'yes',
      }),
    )
  })
  return {
    ok: true,
    warnings,
    report: {
      report_date: asDate(col(first, 'report_date')),
      report_type: asReportType(col(first, 'report_type')),
      provider: strOrNull(col(first, 'provider')),
      body_part: strOrNull(col(first, 'body_part')),
      narrative: strOrNull(col(first, 'narrative')),
      results,
    },
  }
}

/** Dispatch by file name / content: JSON (primary) or CSV. */
export function parseMedicalFile(fileName: string, text: string): ParseResult {
  const lower = fileName.toLowerCase()
  const looksJson = lower.endsWith('.json') || text.trimStart().startsWith('{')
  if (looksJson) return parseMedicalJson(text)
  if (lower.endsWith('.csv')) return parseMedicalCsv(parseCsv(text))
  // Unknown extension: try JSON then CSV.
  const asJson = parseMedicalJson(text)
  return asJson.ok ? asJson : parseMedicalCsv(parseCsv(text))
}
