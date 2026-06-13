# WellWorth — Project Memory

WellWorth is a personal (later: small-family) wellness and net-worth tracker, styled after Cronometer.
It is built as an installable PWA so it runs on iPhone and iPad with no Apple Developer account.

**Read `/docs` before planning or building.** The six spec docs there are the source of truth:
`00-PRD.md`, `01-screens.md`, `02-tech-spec.md`, `03-data-model.md`, `04-design-system.md`, `05-seed-data.md`.
(`docs/BUILD-LOG.md` is a non-spec engineering history — build sequence, rationale, and past-failure
warnings — not a source of truth for behavior.)

**Before changing existing code, read `docs/BUILD-LOG.md`** to understand how Phase 1 was built and
which past approaches failed (and see `docs/PARKED.md` for what's intentionally deferred).

## Scope discipline

- Build **Wellness first**. **Do not build Net Worth yet** — it is Phase 2 (see PRD).
- Steps are entered **manually**. Do not attempt HealthKit / native step sync (impossible in a PWA).

## Stack (do not substitute without asking)

- React + Vite + TypeScript (strict), Tailwind CSS, `vite-plugin-pwa`, React Router (the unified
  `react-router` package — import from `react-router`).
- Supabase (Postgres + Auth + Google OAuth) for data, auth, and cross-device sync.
- `@zxing/library` + `@zxing/browser` for barcode scanning. Recharts is a dependency reserved for the
  Phase-2 net-worth trend graph (not used in Phase-1 Wellness).
- Food data: USDA FoodData Central (search) + Open Food Facts (barcode).

## Architecture rules (always apply)

- **No SQL in the front end.** Components never call Supabase directly and never contain SQL.
  All DB access goes through a typed data-access layer in `/src/data/*` that wraps the
  `supabase-js` query builder. Raw SQL lives **only** in `/supabase/migrations/`.
- **Generated DB types are the contract.** Keep `/src/types/database.ts` generated from the schema;
  regenerate after every schema change. Never hand-edit it.
- **Shared UI only.** Reusable components live in `/src/components`; never duplicate UI.
  Global constants in `/src/constants`; pure helpers in `/src/lib` or `/src/utils`.
- **Clarity and DRY, but never sacrifice runtime performance to reuse code.** If reuse would add meaningful overhead on a hot path, prefer a fast purpose-built implementation and note why.
- **Units are stored in metric** (kg, cm, g, ml, per-100g). Convert to the user's chosen display unit only at the UI boundary, through a single `units` helper. Never store imperial.
- **Every async view has explicit loading, empty, and error states.**

## Security (non-negotiable)

- RLS is ON for every table from its first migration; policy = `user_id = auth.uid()` for user-owned
  tables. Child tables without their own `user_id` (`serving`, `strength_set`) enforce ownership via
  an `EXISTS` check against their parent.
- **Migrations must also `GRANT` table privileges to the `anon`/`authenticated` roles.** RLS gates
  _rows_; the role still needs table-level access. Tables created by raw-SQL migrations do **not**
  inherit Supabase's default grants, so an explicit grant migration is required (see `03-data-model.md`).
- The client uses only the **public anon key** (RLS-respecting), injected via a `VITE_`-prefixed env var.
- The **service-role key bypasses RLS** — it must never appear in client code or the repo. Secrets in
  `.env` (gitignored). Only `VITE_`-prefixed vars are exposed to the browser.

## Database workflow

- Schema changes are written as **migration files** in `/supabase/migrations/` (Supabase CLI format).
  You draft the migration; the human reviews and applies it with `supabase db push`.
- **Never** mutate the production schema directly, and **never drop a table**, without explicit confirmation in the conversation.
- After applying a migration, regenerate `/src/types/database.ts`.

## Naming

- Tables: singular, `snake_case` (`food`, `diary_entry`, `strength_set`).
- TS types/components: `PascalCase`. Files: `kebab-case`. Be consistent above all.

## Enforcement (these run automatically; don't rely on memory alone)

- Prettier (format), ESLint (lint, no unused, no `any`), `tsc --noEmit` (types), Vitest (tests)
  run via pre-commit hook and/or CI. Code must pass all four before it is considered done.
