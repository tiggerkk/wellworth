# WellWorth — Build Spec Bundle

Hand-off package for building **WellWorth** (a wellness + net-worth tracker PWA) with Claude Code.

## What's here

- **CLAUDE.md** — always-on rules & conventions. Keep this at your repo root; Claude Code auto-loads it.
- **SETUP.md** — step-by-step: install Claude Code in Trae.ai, connect Supabase, and the exact first prompt.
- **docs/**
  - `00-PRD.md` — what we're building and why; the multi-module Home hub; scope (Wellness + Net Worth).
  - `01-screens.md` — every screen and its behavior (functional spec).
  - `02-tech-spec.md` — stack, architecture, folder layout, calculations, env vars, workflows.
  - `03-data-model.md` — Postgres tables, RLS, relationships, multi-user readiness.
  - `04-design-system.md` — exact dark-theme tokens and components from the approved wireframes.
  - `05-seed-data.md` — full nutrient list (with visibility flags), the seeded activity library, the owner profile.
  - `06-networth.md` — Net Worth (Phase 2): scope, two-table data model, FX, screens, CSV import.
  - `wireframes/` — drop screen screenshots here (optional).
- **templates/** — `custom-foods-template.csv` + an import guide for bulk-adding custom foods/supplements
  (used by Library → **Import CSV**), and `networth-seed-template.csv` (a sanitized example for the
  Phase-2 Net Worth import; your real balances stay gitignored).

## Project documentation

After the Phase-1 build, three living docs sit alongside the spec in `docs/`:

- [`docs/BUILD-LOG.md`](docs/BUILD-LOG.md) — engineering history: the build sequence per milestone,
  the rationale behind key decisions, and "we tried X, it failed, here's why" warnings. Read this to
  understand how the existing app was built before changing it.
- [`docs/PARKED.md`](docs/PARKED.md) — everything deliberately deferred or out of scope (Phase 2 Net
  Worth, multi-user, re-log/restore, etc.), with decisions already made so they aren't re-litigated.
- [`docs/OWNER-RUNBOOK.md`](docs/OWNER-RUNBOOK.md) — non-developer, step-by-step setup: Supabase,
  Google OAuth, the USDA key, env vars, migrations, running locally, GitHub, and the Vercel + iOS
  deploy. Enough to stand up the whole app from a fresh clone.

## How to use it

1. Unzip into your project folder (`CLAUDE.md` at the root, `docs/` beside it).
2. Open the folder in Trae.ai and follow **SETUP.md**.
3. Build **one milestone at a time**. Wellness shipped first; Net Worth (Phase 2) is now in progress.

## Phasing

The app is **multi-module behind a Home hub** (Wellness, Net Worth; more later) — see `00-PRD.md`.
Phase 1 = Wellness (food, supplements, activity, dashboard, library, settings, auth, sync).
Phase 2 = Net Worth — in progress (separate tables; reached via the Home hub; shares only
auth/profile and the app shell).
