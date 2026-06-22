# CONTINUITY — session handoff (Medical module)

> **Purpose.** A living handoff so a fresh session (after a compact/clear) can continue the **Medical**
> module build with no lost context. This is a pointer + state doc — the _behaviour_ source of truth is
> still `CLAUDE.md`, `/docs/00–05`, and `docs/medical.md`; the _engineering history_ is
> `docs/BUILD-LOG.md`. **Keep this updated at the end of each milestone; delete it when Medical is
> feature-complete.**

## TL;DR — where we are

WellWorth is a 5-module PWA (Wellness, Net Worth, Shows, Books, Quotes — all feature-complete). We are
building a **6th module, Medical** (multi-year lab results + narrative reports, trend dashboard,
structured import, biometric lock), one milestone at a time.

- **Shipped this session: M1, M2, M3.** All gates green (`npm run check` → format + lint + typecheck +
  **295 Vitest tests**).
- **Next: M4** (Dashboard trends + tracked-test selection). Then M5 (drag-to-reorder Settings), M6
  (biometric lock), M7 (narrative + eye refraction).
- **The approved milestone plan** (full detail for each milestone, incl. M1–M3 as shipped and the
  M4–M7 sketches + design decisions) lives at:
  `C:\Users\tigge\.claude\plans\we-re-starting-a-new-shiny-nygaard.md` — **read it first.**

## Build order (from `docs/medical.md`)

1. ✅ **M1** — schema + RLS + seed `medical_lab_test` + module scaffold.
2. ✅ **M2** — manual report CRUD + Report detail.
3. ✅ **M3** — structured JSON/CSV import + tolerant repair + unit normalization + review-confirm +
   Settings importer toggle + Visible-Fields sheet.
4. ⬜ **M4** — Dashboard trends (lazy Recharts, reuse `NetWorthTrendChart` + a time-window selector) +
   latest-values-by-category (flag-coloured) + reports timeline; **Tracked Tests** picker in
   `MedicalSettings` (mirror `VisibleNutrientsSheet`), seeded from `default_tracked`. **Also do the
   deferred first-run seed** of `profile.medical_tracked_tests` from `defaultTrackedTestKeys()` in
   `ensureOwnerProfile` (`src/data/profile.ts`) — see "Deferred" below.
5. ⬜ **M5** — drag-to-reorder Settings (sections + tests within a section) → `medical_section_order` /
   `medical_test_order`; `orderResultsForDisplay(results, sectionOrder?, testOrder?)` already accepts
   the override params. Pointer-based reorder in-house (no new dep) unless we decide otherwise.
6. ⬜ **M6** — biometric lock (WebAuthn platform authenticator + **mandatory PIN fallback**;
   client-side UX gate; adjustable auto-lock timeout `medical_lock_timeout_minutes`). See the plan's
   "Biometric lock — how I'll handle the PWA limitations" section; all profile columns already exist.
7. ⬜ **M7** — narrative reports already render; add the **eye refraction** six-field UI
   (`sphere_od…addition_os`) on the Add/Edit form (they already store/trend as `medical_result` rows).

## Owner / environment state (important)

- **DB migrations are APPLIED and `database.ts` is regenerated.** The owner ran `supabase db reset
--linked` (or `db push`) + `npm run gen:types`. The three Medical tables + 9 `profile.medical_*`
  columns exist in `src/types/database.ts`. **No pending owner step right now.** (If you add/change a
  migration in M4–M7, the owner must re-apply + re-`gen:types` before TS that references new columns
  will typecheck — `gen:types` is `--linked`, so you can't run it without the schema pushed.)
- **DB workflow (from memory):** the owner resets via `supabase db reset --linked`; **edit existing
  migration files in place, don't stack new patch migrations** while iterating a not-yet-final change.
- **Real data is gitignored.** `templates/medical-import-2021.json … -2026.json` and
  `templates/2024-0523 Report.pdf` contain real PII (name/HKID/DOB) and are ignored
  (`medical-import-20*.json`, `templates/*.pdf`). They are present **locally** (useful for validation).
  Only the prompt, JSON schema, and the sanitized `medical-import-template.json` are tracked.

## File map (what exists for Medical)

- **Migrations** (`supabase/migrations/`): `20260622120000_medical_schema.sql` (3 tables),
  `20260622130000_profile_medical_settings.sql` (9 columns), `20260622121000_seed_medical_lab_test.sql`
  (~151 tests).
- **Pure logic** (`src/lib/`): `medical.ts` (enums, `MEDICAL_LAB_TESTS` seed source-of-truth, DB type
  aliases, `labTestByKey`, `medicalTestsByCategory`, `orderResultsForDisplay`, field-visibility,
  `formatResultValue`/`formatRefRange`), `medical-units.ts` (`normalizeResult`), `medical-import.ts`
  (`repairMedicalJson`, `parseMedicalJson`/`parseMedicalCsv`/`parseMedicalFile`, `matchTestKey`),
  `medical-draft.ts` (shared `ReportDraft`/`ResultDraft` + mappers + `draftToSaveInput`),
  `medical-refresh.ts` (`bumpMedical`/`useMedicalVersion`). Tests: `medical.test.ts`,
  `medical-units.test.ts`, `medical-import.test.ts`.
- **Data** (`src/data/medical.ts`): `listReports`, `getReportWithResults`, `createReport`/
  `updateReport`/`deleteReport`, `saveReportResults` (idempotent delete-then-insert),
  `saveReport`, `findReportByDateType`, `saveImportedReport` (idempotent on date+type).
- **Components** (`src/components/`): `MedicalTestPickerSheet` (local overlay), `MedicalResultCard`
  (shared row editor).
- **Screens** (`src/screens/`): `MedicalDashboard` (stub → M4), `MedicalReports`, `MedicalReportDetail`,
  `MedicalEntry`, `MedicalSettings`, `MedicalFieldsSheet`, `ImportMedicalSheet`. Registered in
  `src/screens/index.ts` + `src/router.tsx`; routes in `src/constants/routes.ts` (`routes.medical`),
  module card/tabs in `src/constants/modules.ts`.

## Key decisions made this session (don't re-litigate)

- **Seed (M1):** 151 canonical tests from the owner's 2021–2026 reports (3 providers). `default_unit`
  is the **canonical unit** the importer normalizes to. Flagged choices: BP split into two numeric keys;
  thyroid `t4_total` vs `free_t4`/`free_t3` distinct; H. pylori serology vs C-13 breath test separate;
  cardiac/iron markers + radiation rows → `other`; ECG intervals → `imaging`; tracked starter set =
  the 20 `default_tracked` rows. The seed SQL **mirrors** `MEDICAL_LAB_TESTS`; `medical.test.ts`
  cross-checks them (drift guard) via a `?raw` import of the `.sql`.
- **Unit normalization (M3):** at **import** only, convert to each test's `default_unit`; store the
  normalized value + set `normalized=true` + keep `value_num_original`/`unit_original`; convert
  `ref_low/high` by the same factor; keep `ref_text` verbatim. Manual entry stores **as-entered**
  (`normalized=false`) with a single "as printed" `ref_text` field. This **amends** the global "never
  recompute" rule to a flagged/reversible unit transform — the app still never derives clinical values.
- **Routing:** report **detail** (`/medical/:id`, read-only) is separate from the **form**
  (`/medical/entry` new, `/medical/:id/edit` edit) per `docs/medical.md`.
- **Idempotent import:** `saveImportedReport` replaces a report with the same `report_date` +
  `report_type` (so re-importing a year's file never duplicates).
- **Matching:** `matchTestKey` uses an alnum index over `MEDICAL_LAB_TESTS` display names + curated
  GLOBAL/CATEGORY alias maps; **cuts a bilingual name at the first CJK char** (English head only);
  `%`→`pct` / `#`→`abs` keeps the differential distinction. Validated against the real 6 files:
  2021 83/83 · 2022 83/83 · 2023 81/83 · 2024 44/57 · 2025 109/109 · 2026 113/113 — remaining ad-hocs
  are CJK-only microscopy rows and 2024 imaging/exam narrative findings (correctly left ad-hoc).

## Deferred items to pick up

- **First-run seed of `medical_tracked_tests`** (do in M4 with the tracked picker): in
  `ensureOwnerProfile` (`src/data/profile.ts`), set `medical_tracked_tests:
defaultTrackedTestKeys()` — mirrors how `visible_nutrients` is seeded. (Types now exist for it.)
- M5/M6/M7 features as listed above.

## Conventions reminder (so new code matches)

- No SQL in components → `src/data/*`. Generated `database.ts` is the contract. Pure helpers in
  `src/lib/*`, UI in `src/components/*`, screens in `src/screens/*`. Reuse shared UI (don't duplicate).
- Migrations: RLS on + 4 owner policies `(select auth.uid()) = user_id` + CHECK enums + `moddatetime`
  - GRANTs to `anon`/`authenticated` (reference tables are read-only: single SELECT policy + grant).
- Every async view has loading/empty/error states. Dates are civil `IsoDate` via `src/lib/date.ts`.
- Module refresh tick pattern (`bumpMedical`/`useMedicalVersion`) + `useAsync` deps.
- **Docs are part of "done"**: update `/docs` (PRD/screens/tech-spec/data-model/seed-data/design),
  `BUILD-LOG.md` (append the milestone + bump the snapshot test count), `PARKED.md`, `OWNER-RUNBOOK.md`,
  `README.md`, **and this `CONTINUITY.md`**, then `npm run format` and ensure `npm run check` passes.

## Gotchas hit this session (avoid re-discovering)

- **ESLint `no-irregular-whitespace`:** a literal CJK character class in a regex can include U+3000
  (ideographic space) → lint error. `medical-import.ts#alnum` uses a char-by-char loop instead (no
  literal non-ASCII regex). Don't reintroduce a literal-CJK regex.
- **`gen:types` is `--linked`** → can't regenerate types without the migration pushed (owner step). M1
  split the lib so nothing referenced `Tables<'medical_*'>` until the owner regenerated for M2.
- **`?raw` import** (declared by `vite/client`) lets a test read a `.sql`/`.json` file as a string
  without node `fs` types under `tsconfig.app.json` — used by the seed drift test. Don't write tests
  that depend on **gitignored** real-data files (they won't exist in CI).
- **delete-then-insert is non-transactional** (`saveReportResults`/`saveImportedReport`) — accepted
  solo-app trade-off, same as `saveSnapshotEntries`/`replaceServings`. A transactional RPC is a later
  nicety, not a bug.

## How to verify

- `npm run check` — format + lint + typecheck + tests (currently **295** passing).
- `npm run dev` then drive: Home → **Medical** card → New Medical (manual add with the test picker +
  a custom test) → CREATE → Reports list → tap → detail (grouped, flag-coloured) → Edit → RESET/SAVE →
  swipe-delete. For import: Medical → Settings → enable importer → Import → pick a (local, gitignored)
  `templates/medical-import-2025.json` → review counts → paste a Drive link → Save → lands on detail.
