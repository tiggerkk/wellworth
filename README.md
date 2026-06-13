# WellWorth — Build Spec Bundle

Hand-off package for building **WellWorth** (a wellness + net-worth tracker PWA) with Claude Code.

## What's here

- **CLAUDE.md** — always-on rules & conventions. Keep this at your repo root; Claude Code auto-loads it.
- **SETUP.md** — step-by-step: install Claude Code in Trae.ai, connect Supabase, and the exact first prompt.
- **docs/**
  - `00-PRD.md` — what we're building and why; scope (Wellness now, Net Worth later).
  - `01-screens.md` — every screen and its behavior (functional spec).
  - `02-tech-spec.md` — stack, architecture, folder layout, calculations, env vars, workflows.
  - `03-data-model.md` — Postgres tables, RLS, relationships, multi-user readiness.
  - `04-design-system.md` — exact dark-theme tokens and components from the approved wireframes.
  - `05-seed-data.md` — full nutrient list (with visibility flags), the nine seeded activities, the owner profile.
  - `wireframes/` — drop screen screenshots here (optional).

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
3. Build **one milestone at a time**, Wellness first. Do not build Net Worth yet.

## Phasing

Phase 1 = Wellness (food, supplements, activity, dashboard, library, settings, auth, sync).
Phase 2 = Net Worth (later; separate tables, shares only auth/profile and the app shell).
