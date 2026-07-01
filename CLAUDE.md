# WellWorth Architecture & Coding Rules

## Documentation Sync

- **Spec docs** - Update corresponding `/docs/` specs (`00_PRD.md` to `11_literature.md`) immediately inside the same task when behavior or schema changes.
- **`docs/PARKED.md`** — remove an item when it's built; add one when something is deliberately deferred or a limitation is discovered.
- **`docs/OWNER_RUNBOOK.md`** — update when setup, scripts, env vars, migrations, or deploy/reset steps change (it must still stand up the app from a fresh clone).

## Stack & Formatting

- React + Vite + Strict TS, Tailwind CSS, `vite-plugin-pwa`, Supabase (Postgres + Auth).
- Output answers in concise bullet points unless explicitly asked to explain.
- Run `npm run format` after changing code or docs.

## Code & Architecture Constraints

- **No Frontend SQL:** All DB operations must use the typed data-access layer in `/src/data/*`. Raw SQL lives **only** in `/supabase/migrations/`.
- **Type Contract:** Never hand-edit `/src/types/database.ts`; regenerate it after schema changes.
- **Data Units:** Always store in metric (kg, cm, g, ml); convert to imperial only at the UI boundary.
- **UI States:** Every async view requires explicit loading, empty, and error states.
- **Design Tokens:** Use typography role tokens (`text-title/heading/field/body/label`). No hardcoded pixel sizes (`text-[Npx]`).
- **PWA / Mobile Floor:** Elements must support rem-based dynamic scaling and a $\ge 16\text{px}$ touch target floor for inputs.
- **Shared UI only.** Reusable components live in `/src/components`; never duplicate UI. Global constants in `/src/constants`; pure helpers in `/src/lib` or `/src/utils`.
- **Clarity and DRY, but never sacrifice runtime performance to reuse code.** If reuse would add meaningful overhead on a hot path, prefer a fast purpose-built implementation and note why.

## Security & Database Workflow

- **RLS:** Mandatory on all tables (`user_id = auth.uid()`). Explicitly `GRANT` privileges to `anon`/`authenticated` roles in migrations.
- **Migrations:** Edit existing files in `supabase/migrations/` in-place using `NN_<module>_<name>.sql` naming.
- **DB Resets:** Applied via `supabase db reset --linked`. If Google login loops with `signup_disabled`, temporarily toggle "Allow new users to sign up" ON in the Supabase console.
- The client uses only the **public anon key** (RLS-respecting), injected via a `VITE_`-prefixed env var.

## Naming

- Tables: singular, `snake_case` (`food`, `diary_entry`, `strength_set`).
- TS types/components: `PascalCase`. Files: `kebab-case`. Be consistent above all.

## Enforcement

- Prettier (format), ESLint (lint, no unused, no `any`), type-check via **`npm run typecheck`** (`tsc -p tsconfig.app.json`; a bare `tsc --noEmit` checks nothing — the root `tsconfig.json` is references-only), and Vitest (tests). All four run via the pre-commit hook and/or CI and are wrapped by `npm run check` — code must pass them before considered done.
