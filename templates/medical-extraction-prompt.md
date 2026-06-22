# Medical Report → JSON Extraction Prompt (model-agnostic)

Use this with **any** vision-capable AI tool (Claude, Gemini, GPT, etc.). Upload your medical-report
PDF (or page images) and paste the prompt below. Save the model's output as a `.json` file, then import
it into WellWorth → Medical → Import.

> Tip: if a tool won't output a file, copy its JSON text into a plain-text file named e.g.
> `2026-05-04_screening.json`. Validate it at jsonlint.com if unsure.

---

## PROMPT (copy everything in this block)

```
You are a careful medical-report data extractor. I will give you a scanned health-report PDF (it may be
bilingual English/Chinese, multi-column, and tabular). Extract every test result into JSON only.

CRITICAL RULES — accuracy over completeness:
1. Output ONLY a single JSON object. No prose, no markdown, no code fences around it.
2. Transcribe numbers EXACTLY as printed. Preserve every decimal point and decimal place
   (e.g. "2.9" must stay 2.9, never 29; "0.21" stays 0.21). Never round, infer, or compute.
3. If a value is unclear, unreadable, or you are not confident, set "value_num" to null and put what
   you see in "value_text", and set "uncertain": true. Do NOT guess a number.
4. Use the English test name when both languages are shown. Keep the provider's exact reference range
   text in "ref_text", and ALSO split it into ref_low / ref_high when it is a clean numeric range
   (e.g. "3.5 - 7.2" -> ref_low 3.5, ref_high 7.2). For one-sided ranges ("<5.2", ">0.9", "Optimal:
   <2.59") leave ref_low/ref_high null and keep the text in ref_text.
5. "flag": "high" if the report marks the value high (H, ↑, *), "low" if low (L, ↓), "abnormal" for a
   flagged non-numeric result, else null. Do not infer a flag the report didn't print.
6. "unit": exactly as printed (mmol/L, U/L, g/dL, umol/L, K/uL, %, etc.); null if none.
7. Qualitative results (e.g. "Normal", "Negative", "Not found", imaging impressions): put the text in
   "value_text", leave "value_num" null.
8. "category": classify each test into ONE of: general, vitals, lipids, glucose, liver, renal,
   electrolytes, cbc, thyroid, bone, tumour_markers, hepatitis, inflammation, urine, stool, imaging,
   eye, other. (general = BMI/weight/height/body-composition; vitals = blood pressure/pulse/oximetry.)
9. For eye reports, also extract refraction as separate rows with these exact test names when present:
   "Sphere (OD)", "Cylinder (OD)", "Addition (OD)", "Sphere (OS)", "Cylinder (OS)", "Addition (OS)"
   (OD = right eye, OS = left eye), category "eye".
10. Narrative findings (MRI impressions, ultrasound/x-ray findings, doctor's comments) go in the
    top-level "narrative" string, not as test rows.
11. Preserve the order in which tests appear in the report.
12. DO NOT SKIP SECTIONS. Scan the WHOLE document, every page, and include each of these when present —
    they are commonly missed on dense scans:
    - Bone density / osteoporosis: T-score, Z-score, "Speed of Sound", BMD (category "bone").
    - Vitals as discrete rows: Blood Pressure (systolic/diastolic), Pulse, Pulse Oximetry (category "vitals").
    - Body metrics as discrete rows: BMI, Body Mass Index, Weight, Height, Body Fat (category "general").
    - Lung function: FEV1, FEV1/FVC (category "other").
    - Tumour markers: AFP, CEA, CA 125, PSA (category "tumour_markers").
    - Imaging/exam findings (Chest X-ray, ECG, Ultrasound of any organ, physical/gynae exam): put each
      finding into "narrative" (and, if it has a clear normal/abnormal status, also as a result row with
      value_text, category "imaging").
13. SELF-CHECK before returning: re-scan every page and confirm you did not skip any test row, any
    bone-density result, any vitals/BMI row, or any imaging/narrative finding. If a section exists but a
    value is unreadable, still include the row with value_num null, value_text with what you see, and
    "uncertain": true — never drop it silently.
14. OUTPUT VALID JSON: every property separated by a comma; no stray quotes after numbers
    (write 1.7 then a comma, never 1.7"); numbers are bare (no quotes). Re-read your output once to
    confirm it parses.

Fill these top-level fields too:
- "report_date": the examination/collection date as "YYYY-MM-DD" (null if not shown).
- "report_type": one of "health_screening","mri","ultrasound","mammogram","eye","other".
- "provider": the clinic/lab name as printed (null if none).
- "body_part": for mri/ultrasound/mammogram, the body part/organ (e.g. "neck","breast","pelvis"); else null.

Output JSON in EXACTLY this shape:

{
  "report_date": "YYYY-MM-DD | null",
  "report_type": "health_screening | mri | ultrasound | mammogram | eye | other",
  "provider": "string | null",
  "body_part": "string | null",
  "narrative": "string | null",
  "results": [
    {
      "test_name": "string",
      "category": "general|vitals|lipids|glucose|liver|renal|electrolytes|cbc|thyroid|bone|tumour_markers|hepatitis|inflammation|urine|stool|imaging|eye|other",
      "value_num": 0.0,
      "value_text": "string | null",
      "unit": "string | null",
      "ref_low": 0.0,
      "ref_high": 0.0,
      "ref_text": "string | null",
      "flag": "high | low | abnormal | null",
      "uncertain": false
    }
  ]
}

Return the JSON now, and nothing else.
```

---

## After you get the JSON

1. **Spot-check the numbers** against the PDF — especially decimals (LDL, HDL, glucose, creatinine).
   Cheap OCR drops decimals (LDL 2.9 → 29); confirm yours are intact. Fix any `"uncertain": true` rows.
2. Save as `YYYY-MM-DD_<type>.json`.
3. In WellWorth → **Medical → Import**, select the file, review the parsed rows on the confirm screen,
   paste your Google Drive link(s) for the original document, and Save.

CSV alternative: if you prefer a spreadsheet, the same fields can be a CSV with the header in
`medical-import.schema.json`; the app accepts either (parsed with an RFC-4180-compliant parser).
