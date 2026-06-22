# WellWorth — Build Spec Bundle

Hand-off package for building **WellWorth** (a wellness + net-worth tracker PWA) with Claude Code.

## What's here

- **CLAUDE.md** — always-on rules & conventions. Keep this at your repo root; Claude Code auto-loads it.
- **docs/**
  - `00-PRD.md` — what we're building and why; the multi-module Home hub; scope (Wellness, Net Worth, Shows, Books, Quotes, Medical).
  - `medical.md` — staging spec + build order for the **Medical** module (kept until it is feature-complete, then merged into the permanent specs and deleted, like the former `06-books.md`/`07-quotes.md`).
  - `01-screens.md` — every screen and its behavior (functional spec).
  - `02-tech-spec.md` — stack, architecture, folder layout, calculations, env vars, workflows.
  - `03-data-model.md` — Postgres tables, RLS, relationships, multi-user readiness.
  - `04-design-system.md` — exact dark-theme tokens and components from the approved wireframes.
  - `05-seed-data.md` — full nutrient list (with visibility flags), the seeded activity library, the owner profile.
  - `wireframes/` — drop screen screenshots here (optional).
- **templates/** — `custom-foods-template.csv` + an import guide for bulk-adding custom foods/supplements (used by Library → **Import CSV**), `networth-seed-template.csv` + `networth-import-guide.md` for the Net Worth importer, `shows-import-template.csv` + `shows-import-guide.md` for the Shows importer, `books-import-template.csv` + `books-import-guide.md` for the Books importer, `quotes-import-template.csv` + `quotes-import-guide.md` for the Quotes importer, and for **Medical** the `medical-extraction-prompt.md` (model-agnostic AI prompt), `medical-import.schema.json` (JSON shape + CSV header), and a sanitized `medical-import-template.json` (sanitized examples; your real balances / watch + reading history / quote collection / **lab results + report PDFs** stay gitignored).

## Project documentation

After the Phase-1 build, three living docs sit alongside the spec in `docs/`:

- [`docs/BUILD-LOG.md`](docs/BUILD-LOG.md) — engineering history: the build sequence per milestone,
  the rationale behind key decisions, and "we tried X, it failed, here's why" warnings. Read this to
  understand how the existing app was built before changing it.
- [`docs/PARKED.md`](docs/PARKED.md) — everything deliberately deferred or out of scope (multi-user, re-log/restore, etc.), with decisions already made so they aren't re-litigated.
- [`docs/OWNER-RUNBOOK.md`](docs/OWNER-RUNBOOK.md) — non-developer, step-by-step setup: Supabase,
  Google OAuth, the USDA key, env vars, migrations, running locally, GitHub, and the Vercel + iOS
  deploy. Enough to stand up the whole app from a fresh clone.
- [`CONTINUITY.md`](CONTINUITY.md) — **transient session handoff** for the in-progress **Medical**
  module: what's shipped (M1–M3) vs. next (M4–M7), the file map, key decisions, and gotchas. Read it
  before continuing Medical; delete it when the module is feature-complete.

## How to use it

1. Unzip into your project folder (`CLAUDE.md` at the root, `docs/` beside it).
2. Open the folder in Trae.ai and follow **SETUP.md**.
3. Build **one milestone at a time**. Wellness, Net Worth, Shows, Books, and Quotes shipped; Medical is building (M1 done).

## Phasing

The app is **multi-module behind a Home hub** (Wellness, Net Worth, Shows, Books, Quotes, Medical; more later) — see `00-PRD.md`.
Wellness (food, supplements, activity, dashboard, library, settings, auth, sync).
Net Worth (separate tables; reached via the Home hub; shares only auth/profile and the app shell).
Shows (TV, movies & documentaries, incl. Chinese titles; Chinese-aware TMDB metadata, favourites (♥), an optional Poster URL field (a Visible-Fields toggle, off by default) + per-show Refresh, dashboard shelves, a filterable/sortable library, field-visibility settings, and a CSV importer; shares only auth/profile and the app shell).
Books (books read / to read; TV-show re-skin — Google Books / Open Library metadata, favourites (♥), dashboard shelves, a filterable/sortable library, field-visibility settings, and a CSV importer; shares only auth/profile and the app shell).
Quotes (favourite quotes from screen/page/sound, English or Chinese; favourites (♥), a Moment-of-Zen random-quote dashboard, a filterable library, an optional cross-module link to a local Show/Book, field-visibility settings, and a CSV importer — no external metadata API; shares only auth/profile and the app shell).
Medical (multi-year lab results + narrative reports with trend charts; structured JSON/CSV import — no in-app OCR — with cross-provider unit normalization, Google-Drive-URL storage, and a biometric lock; building one milestone at a time, M1 schema+seed+scaffold shipped; shares only auth/profile and the app shell).
