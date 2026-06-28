-- Seed the medical_lab_test reference table (docs/medical.md → 05-seed-data.md).
--
-- Idempotent: ON CONFLICT (key) DO UPDATE so this reaches production via `supabase db push` and is
-- safe to re-run (and lets a future migration correct values). This list is the SQL mirror of
-- src/lib/medical.ts (MEDICAL_LAB_TESTS) — the front-end source of truth; src/lib/medical.test.ts
-- cross-checks the two so they can't drift.
--
-- Built from the owner's 2021–2026 reports across three providers. `default_unit` is the canonical
-- unit the importer normalizes incoming values to; `default_tracked` is the Dashboard starter set;
-- `value_kind` documents numeric / qualitative / either. Category-level section order is applied in
-- the app; sort_order orders tests within a category.

insert into public.medical_lab_test
  (key, display_name, default_unit, category, sort_order, default_tracked, value_kind)
values
  -- general
  ('bmi', 'BMI', null, 'general', 10, true, 'numeric'),
  ('weight', 'Weight', 'kg', 'general', 20, false, 'numeric'),
  ('height', 'Height', 'cm', 'general', 30, false, 'numeric'),
  ('body_fat_pct', 'Body Fat %', '%', 'general', 40, false, 'numeric'),
  ('body_fat_mass', 'Body Fat Mass', 'kg', 'general', 50, false, 'numeric'),
  ('skeletal_muscle_mass', 'Skeletal Muscle Mass (SMM)', 'kg', 'general', 60, false, 'numeric'),
  ('fat_free_mass', 'Fat-Free Mass', 'kg', 'general', 70, false, 'numeric'),
  ('total_body_water', 'Total Body Water', 'L', 'general', 80, false, 'numeric'),
  ('protein_mass', 'Protein (mass)', 'kg', 'general', 90, false, 'numeric'),
  ('mineral_mass', 'Minerals (mass)', 'kg', 'general', 100, false, 'numeric'),
  ('waist_hip_ratio', 'Waist–Hip Ratio', null, 'general', 110, false, 'numeric'),
  ('visceral_fat_level', 'Visceral Fat Level', null, 'general', 120, false, 'numeric'),
  ('basal_metabolic_rate', 'Basal Metabolic Rate', 'kcal', 'general', 130, false, 'numeric'),
  ('obesity_degree', 'Obesity Degree', '%', 'general', 140, false, 'numeric'),

  -- vitals
  ('blood_pressure_systolic', 'Blood Pressure (Systolic)', 'mmHg', 'vitals', 10, true, 'numeric'),
  ('blood_pressure_diastolic', 'Blood Pressure (Diastolic)', 'mmHg', 'vitals', 20, true, 'numeric'),
  ('pulse', 'Pulse', '/min', 'vitals', 30, false, 'numeric'),
  ('pulse_oximetry', 'Pulse Oximetry', '%', 'vitals', 40, false, 'numeric'),
  ('pulse_pressure_difference', 'Pulse Pressure Difference', 'mmHg', 'vitals', 50, false, 'numeric'),

  -- lipids
  ('total_cholesterol', 'Total Cholesterol', 'mmol/L', 'lipids', 10, true, 'numeric'),
  ('ldl_cholesterol', 'LDL Cholesterol', 'mmol/L', 'lipids', 20, true, 'numeric'),
  ('hdl_cholesterol', 'HDL Cholesterol', 'mmol/L', 'lipids', 30, true, 'numeric'),
  ('triglycerides', 'Triglycerides', 'mmol/L', 'lipids', 40, true, 'numeric'),
  ('vldl_cholesterol', 'VLDL Cholesterol', 'mmol/L', 'lipids', 50, false, 'numeric'),
  ('non_hdl_cholesterol', 'Non-HDL Cholesterol', 'mmol/L', 'lipids', 60, false, 'numeric'),
  ('total_lipid', 'Total Lipid', 'g/L', 'lipids', 70, false, 'numeric'),
  ('lipoprotein_a', 'Lipoprotein(a)', 'mg/dL', 'lipids', 80, false, 'numeric'),

  -- glucose
  ('fasting_glucose', 'Fasting Blood Glucose', 'mmol/L', 'glucose', 10, true, 'numeric'),
  ('hba1c', 'HbA1c', '%', 'glucose', 20, true, 'numeric'),

  -- liver
  ('alt_sgpt', 'ALT (SGPT)', 'U/L', 'liver', 10, true, 'numeric'),
  ('ast_sgot', 'AST (SGOT)', 'U/L', 'liver', 20, true, 'numeric'),
  ('ast_alt_ratio', 'AST/ALT Ratio', null, 'liver', 30, false, 'numeric'),
  ('alp', 'Alkaline Phosphatase (ALP)', 'U/L', 'liver', 40, false, 'numeric'),
  ('ggt', 'Gamma-GT (GGT)', 'U/L', 'liver', 50, false, 'numeric'),
  ('total_protein', 'Total Protein', 'g/L', 'liver', 60, false, 'numeric'),
  ('albumin', 'Albumin', 'g/L', 'liver', 70, false, 'numeric'),
  ('globulin', 'Globulin', 'g/L', 'liver', 80, false, 'numeric'),
  ('ag_ratio', 'A/G Ratio', null, 'liver', 90, false, 'numeric'),
  ('bilirubin_total', 'Bilirubin, Total', 'umol/L', 'liver', 100, false, 'numeric'),
  ('bilirubin_direct', 'Bilirubin, Direct', 'umol/L', 'liver', 110, false, 'numeric'),
  ('bilirubin_indirect', 'Bilirubin, Indirect', 'umol/L', 'liver', 120, false, 'numeric'),

  -- renal
  ('creatinine', 'Creatinine', 'umol/L', 'renal', 10, true, 'numeric'),
  ('urea', 'Urea (BUN)', 'mmol/L', 'renal', 20, true, 'numeric'),
  ('uric_acid', 'Uric Acid', 'mmol/L', 'renal', 30, true, 'numeric'),

  -- electrolytes
  ('sodium', 'Sodium', 'mmol/L', 'electrolytes', 10, false, 'numeric'),
  ('potassium', 'Potassium', 'mmol/L', 'electrolytes', 20, false, 'numeric'),
  ('chloride', 'Chloride', 'mmol/L', 'electrolytes', 30, false, 'numeric'),
  ('bicarbonate', 'Bicarbonate', 'mmol/L', 'electrolytes', 40, false, 'numeric'),
  ('calcium', 'Calcium', 'mmol/L', 'electrolytes', 50, false, 'numeric'),
  ('phosphate', 'Phosphate', 'mmol/L', 'electrolytes', 60, false, 'numeric'),
  ('magnesium', 'Magnesium', 'mmol/L', 'electrolytes', 70, false, 'numeric'),

  -- cbc
  ('haemoglobin', 'Haemoglobin', 'g/dL', 'cbc', 10, true, 'numeric'),
  ('haematocrit', 'Haematocrit', '%', 'cbc', 20, false, 'numeric'),
  ('rbc', 'Red Blood Cells (RBC)', 'M/uL', 'cbc', 30, false, 'numeric'),
  ('wbc', 'White Blood Cells (WBC)', 'K/uL', 'cbc', 40, true, 'numeric'),
  ('platelet', 'Platelet', 'K/uL', 'cbc', 50, true, 'numeric'),
  ('mcv', 'MCV', 'fL', 'cbc', 60, false, 'numeric'),
  ('mch', 'MCH', 'pg', 'cbc', 70, false, 'numeric'),
  ('mchc', 'MCHC', 'g/dL', 'cbc', 80, false, 'numeric'),
  ('rdw', 'RDW', '%', 'cbc', 90, false, 'numeric'),
  ('neutrophils_pct', 'Neutrophils %', '%', 'cbc', 100, false, 'numeric'),
  ('lymphocytes_pct', 'Lymphocytes %', '%', 'cbc', 110, false, 'numeric'),
  ('monocytes_pct', 'Monocytes %', '%', 'cbc', 120, false, 'numeric'),
  ('eosinophils_pct', 'Eosinophils %', '%', 'cbc', 130, false, 'numeric'),
  ('basophils_pct', 'Basophils %', '%', 'cbc', 140, false, 'numeric'),
  ('neutrophils_abs', 'Neutrophils (absolute)', 'K/uL', 'cbc', 150, false, 'numeric'),
  ('lymphocytes_abs', 'Lymphocytes (absolute)', 'K/uL', 'cbc', 160, false, 'numeric'),
  ('monocytes_abs', 'Monocytes (absolute)', 'K/uL', 'cbc', 170, false, 'numeric'),
  ('eosinophils_abs', 'Eosinophils (absolute)', 'K/uL', 'cbc', 180, false, 'numeric'),
  ('basophils_abs', 'Basophils (absolute)', 'K/uL', 'cbc', 190, false, 'numeric'),
  ('reticulocyte_count', 'Reticulocyte Count', '%', 'cbc', 200, false, 'numeric'),
  ('blood_smear', 'Blood Smear', null, 'cbc', 210, false, 'qualitative'),
  ('abo_grouping', 'ABO Grouping', null, 'cbc', 220, false, 'qualitative'),
  ('rh_d_typing', 'Rh(D) Typing', null, 'cbc', 230, false, 'qualitative'),

  -- thyroid
  ('tsh', 'TSH', 'mIU/L', 'thyroid', 10, true, 'numeric'),
  ('t4_total', 'T4 (Total)', 'nmol/L', 'thyroid', 20, false, 'numeric'),
  ('free_t4', 'Free T4 (FT4)', 'pmol/L', 'thyroid', 30, false, 'numeric'),
  ('free_t3', 'Free T3 (FT3)', 'pmol/L', 'thyroid', 40, false, 'numeric'),

  -- bone
  ('bone_t_score', 'Bone Density T-score', null, 'bone', 10, true, 'numeric'),
  ('bone_z_score', 'Bone Density Z-score', null, 'bone', 20, false, 'numeric'),
  ('speed_of_sound', 'Speed of Sound (SOS)', 'm/s', 'bone', 30, false, 'numeric'),
  ('bone_density_interpretation', 'Bone Density Interpretation', null, 'bone', 40, false, 'qualitative'),
  ('vitamin_d_25oh', '25-OH Vitamin D', 'ug/L', 'bone', 50, true, 'numeric'),

  -- tumour_markers
  ('cea', 'CEA', 'ng/mL', 'tumour_markers', 10, false, 'numeric'),
  ('afp', 'AFP', 'ng/mL', 'tumour_markers', 20, false, 'numeric'),
  ('ca_125', 'CA 125', 'U/mL', 'tumour_markers', 30, false, 'numeric'),
  ('ca_15_3', 'CA 15-3', 'U/mL', 'tumour_markers', 40, false, 'numeric'),
  ('ca_19_9', 'CA 19-9', 'U/mL', 'tumour_markers', 50, false, 'numeric'),

  -- hepatitis
  ('hbsag', 'Hepatitis B Surface Antigen (HBsAg)', null, 'hepatitis', 10, false, 'qualitative'),
  ('hbsab', 'Hepatitis B Surface Antibody (HBsAb)', 'mIU/mL', 'hepatitis', 20, false, 'either'),
  ('anti_hav_igg', 'Hepatitis A Antibody IgG (Anti-HAV)', 'mIU/mL', 'hepatitis', 30, false, 'either'),
  ('hcv_antibody', 'Hepatitis C Antibody', 'COI', 'hepatitis', 40, false, 'either'),

  -- inflammation
  ('esr', 'ESR', 'mm/hr', 'inflammation', 10, false, 'numeric'),
  ('crp', 'C-Reactive Protein (CRP)', 'mg/L', 'inflammation', 20, false, 'either'),
  ('rheumatoid_factor', 'Rheumatoid Factor', 'IU/mL', 'inflammation', 30, false, 'either'),

  -- urine
  ('urine_colour', 'Colour (Urine)', null, 'urine', 10, false, 'qualitative'),
  ('urine_appearance', 'Appearance (Urine)', null, 'urine', 20, false, 'qualitative'),
  ('urine_ph', 'pH (Urine)', null, 'urine', 30, false, 'numeric'),
  ('urine_specific_gravity', 'Specific Gravity (Urine)', null, 'urine', 40, false, 'numeric'),
  ('urine_albumin', 'Albumin / Protein (Urine)', null, 'urine', 50, false, 'qualitative'),
  ('urine_sugar', 'Sugar / Glucose (Urine)', null, 'urine', 60, false, 'qualitative'),
  ('urine_bilirubin', 'Bilirubin (Urine)', null, 'urine', 70, false, 'qualitative'),
  ('urine_urobilinogen', 'Urobilinogen (Urine)', 'umol/L', 'urine', 80, false, 'either'),
  ('urine_nitrate', 'Nitrite (Urine)', null, 'urine', 90, false, 'qualitative'),
  ('urine_ketone', 'Ketone (Urine)', null, 'urine', 100, false, 'qualitative'),
  ('urine_blood', 'Blood (Urine)', null, 'urine', 110, false, 'qualitative'),
  ('urine_rbc', 'RBC (Urine)', null, 'urine', 120, false, 'qualitative'),
  ('urine_wbc', 'WBC (Urine)', null, 'urine', 130, false, 'qualitative'),
  ('urine_epithelial', 'Epithelial Cells (Urine)', null, 'urine', 140, false, 'qualitative'),
  ('urine_mucous', 'Mucous (Urine)', null, 'urine', 150, false, 'qualitative'),
  ('urine_cast', 'Cast (Urine)', null, 'urine', 160, false, 'qualitative'),
  ('urine_crystal', 'Crystal (Urine)', null, 'urine', 170, false, 'qualitative'),
  ('urine_other', 'Other (Urine)', null, 'urine', 180, false, 'qualitative'),

  -- stool
  ('stool_colour', 'Colour (Stool)', null, 'stool', 10, false, 'qualitative'),
  ('stool_consistency', 'Consistency (Stool)', null, 'stool', 20, false, 'qualitative'),
  ('stool_pus_cells', 'Pus Cells (Stool)', '/HPF', 'stool', 30, false, 'qualitative'),
  ('stool_rbc', 'RBC (Stool)', '/HPF', 'stool', 40, false, 'qualitative'),
  ('stool_wbc', 'WBC (Stool)', '/HPF', 'stool', 50, false, 'qualitative'),
  ('stool_ova_cyst', 'Ova & Cyst (Stool)', '/HPF', 'stool', 60, false, 'qualitative'),
  ('occult_blood', 'Occult Blood (Stool)', null, 'stool', 70, false, 'qualitative'),

  -- imaging (ECG)
  ('ecg_heart_rate', 'Heart Rate (ECG)', '/min', 'imaging', 10, false, 'numeric'),
  ('p_duration', 'P Duration', 'ms', 'imaging', 20, false, 'numeric'),
  ('pq_interval', 'PQ Interval', 'ms', 'imaging', 30, false, 'numeric'),
  ('qrs_duration', 'QRS Duration', 'ms', 'imaging', 40, false, 'numeric'),
  ('qt_interval', 'QT Interval', 'ms', 'imaging', 50, false, 'numeric'),
  ('qtc_interval', 'QTc Interval', 'ms', 'imaging', 60, false, 'numeric'),
  ('p_axis', 'P Axis', 'deg', 'imaging', 70, false, 'numeric'),
  ('qrs_axis', 'QRS Axis', 'deg', 'imaging', 80, false, 'numeric'),
  ('ecg_finding', 'ECG Finding', null, 'imaging', 90, false, 'qualitative'),

  -- eye
  ('sphere_od', 'Sphere (OD)', 'D', 'eye', 10, false, 'numeric'),
  ('cylinder_od', 'Cylinder (OD)', 'D', 'eye', 20, false, 'numeric'),
  ('addition_od', 'Addition (OD)', 'D', 'eye', 30, false, 'numeric'),
  ('sphere_os', 'Sphere (OS)', 'D', 'eye', 40, false, 'numeric'),
  ('cylinder_os', 'Cylinder (OS)', 'D', 'eye', 50, false, 'numeric'),
  ('addition_os', 'Addition (OS)', 'D', 'eye', 60, false, 'numeric'),
  ('iop', 'Intraocular Pressure (IOP)', 'mmHg', 'eye', 70, false, 'numeric'),

  -- other
  ('cpk_total', 'CPK, Total', 'U/L', 'other', 10, false, 'numeric'),
  ('ck_mb', 'CK-MB', 'ng/mL', 'other', 20, false, 'numeric'),
  ('myoglobin', 'Myoglobin', 'ng/mL', 'other', 30, false, 'numeric'),
  ('hs_ctnl', 'High-sensitivity Troponin (hs-cTnI)', 'pg/mL', 'other', 40, false, 'either'),
  ('ldh', 'LDH', 'U/L', 'other', 50, false, 'numeric'),
  ('amylase', 'Amylase', 'U/L', 'other', 60, false, 'numeric'),
  ('lipase', 'Lipase', 'U/L', 'other', 70, false, 'numeric'),
  ('iron', 'Iron', 'umol/L', 'other', 80, false, 'numeric'),
  ('h_pylori_ab', 'H. pylori Antibody', 'U/mL', 'other', 90, false, 'either'),
  ('h_pylori_breath_test', 'H. pylori C-13 Breath Test', null, 'other', 100, false, 'either'),
  ('position_head', 'Radiation Scan — Head', 'uSv/Hour', 'other', 110, false, 'numeric'),
  ('position_neck', 'Radiation Scan — Neck', 'uSv/Hour', 'other', 120, false, 'numeric'),
  ('position_arm', 'Radiation Scan — Arm', 'uSv/Hour', 'other', 130, false, 'numeric'),
  ('position_back', 'Radiation Scan — Back', 'uSv/Hour', 'other', 140, false, 'numeric'),
  ('position_leg', 'Radiation Scan — Leg', 'uSv/Hour', 'other', 150, false, 'numeric')
on conflict (key) do update set
  display_name    = excluded.display_name,
  default_unit    = excluded.default_unit,
  category        = excluded.category,
  sort_order      = excluded.sort_order,
  default_tracked = excluded.default_tracked,
  value_kind      = excluded.value_kind;
