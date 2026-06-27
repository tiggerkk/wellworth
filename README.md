# WellWorth — Build Spec Bundle

Hand-off package for building **WellWorth** (a wellness + net-worth tracker PWA) with Claude Code.

## What's here

- **CLAUDE.md** — always-on rules & conventions. Keep this at your repo root; Claude Code auto-loads it.
- **docs/**
  - `00-PRD.md` — what we're building and why; the multi-module Home hub; scope (Wellness, Net Worth, Shows, Books, Quotes, Medical, Travel).
  - `01-design-system.md` — dark-theme tokens, shared components, and the button/layout conventions.
  - `02-tech-spec.md` — stack, architecture, folder layout, routing, DB conventions, shared APIs, env vars, quality gates, and the cross-cutting gotchas.
  - `03-global.md` — navigation, first-run onboarding, global Settings, the `profile` table + seeds.
  - `04-wellness.md` … `10-travel.md` — one spec per module (screens, calculations, external APIs, data model, seed data): Wellness, Net Worth, Shows, Books, Quotes, Medical, Travel.
  - `wireframes/` — drop screen screenshots here (optional).
- **templates/** — sanitized example import files + guides (your real balances / watch + reading history / quote collection / **lab results + report PDFs** / **trip + expense files** stay gitignored):
  - **Wellness** — `custom-foods-template.csv` + an import guide for bulk-adding custom foods/supplements (Library → **Import CSV**).
  - **Net Worth** — `networth-seed-template.csv` + `networth-import-guide.md`.
  - **Shows** — `shows-import-template.csv` + `shows-import-guide.md`.
  - **Books** — `books-import-template.csv` + `books-import-guide.md`.
  - **Quotes** — `quotes-import-template.csv` + `quotes-import-guide.md`.
  - **Medical** — `medical-extraction-prompt.md` (model-agnostic AI prompt), `medical-import.schema.json` (JSON shape + CSV header), and a sanitized `medical-import-template.json`.
  - **Travel** — `travel-expenses-template.csv` + `travel-expenses-import-guide.md` (wide expenses CSV); `travel-itinerary.schema.json` + `travel-itinerary-prompt.md` (itinerary JSON).

## Project documentation

After the Phase-1 build, three living docs sit alongside the spec in `docs/`. The first two are read
on demand, not every session:

- [`docs/BUILD-HISTORY.md`](docs/BUILD-HISTORY.md) — chronological engineering history: the
  per-milestone build sequence + dated enhancement passes, with the rationale behind key decisions.
  Read it only for a deep refactor or regression analysis on an older module — durable constraints and
  "don't repeat" gotchas now live in the spec docs.
- [`docs/PARKED.md`](docs/PARKED.md) — the deferred / out-of-scope backlog (multi-user sharing,
  re-log/restore, etc.), with decisions already made so they aren't re-litigated. Read on request.
- [`docs/OWNER-RUNBOOK.md`](docs/OWNER-RUNBOOK.md) — non-developer, step-by-step setup: Supabase,
  Google OAuth, the USDA key, env vars, migrations, running locally, GitHub, the Vercel + iOS deploy,
  and (Part Q) **encrypted DB backups + free-tier keep-alive**. Enough to stand up the whole app from a
  fresh clone.

Ops lives in `scripts/` (`db-backup.sh` / `db-restore.sh`, plus `gen-icons.mjs` which regenerates the
app/PWA icons via `npm run gen:icons`) + `.github/workflows/backup.yml` (scheduled encrypted backup to
a private repo); see OWNER-RUNBOOK Part Q.

## How to use it

1. Unzip into your project folder (`CLAUDE.md` at the root, `docs/` beside it).
2. Follow **[`docs/OWNER-RUNBOOK.md`](docs/OWNER-RUNBOOK.md)** to set up Supabase, Google OAuth, env vars, and the Vercel + iOS deploy. The app is developed with Claude Code (see `CLAUDE.md`).
3. Build **one milestone at a time**. Wellness, Net Worth, Shows, Books, Quotes, Medical, and Travel have all shipped (feature-complete).

## Phasing

The app is **multi-module behind a Home hub** (Wellness, Net Worth, Shows, Books, Quotes, Medical, Travel; more later) — see `00-PRD.md`.
Wellness (food, supplements, activity, dashboard, library, settings, auth, sync).
Net Worth (separate tables; reached via the Home hub; shares only auth/profile and the app shell).
Shows (TV, movies & documentaries, incl. Chinese titles; Chinese-aware TMDB metadata, favourites (♥), an optional Poster URL field (a Visible-Fields toggle, off by default) + per-show Refresh, dashboard shelves, a filterable/sortable library, field-visibility settings, and a CSV importer; shares only auth/profile and the app shell).
Books (books read / to read; TV-show re-skin — Google Books / Open Library metadata, favourites (♥), dashboard shelves, a filterable/sortable library, field-visibility settings, and a CSV importer; shares only auth/profile and the app shell).
Quotes (favourite quotes from screen/page/sound, English or Chinese; favourites (♥), a Moment-of-Zen random-quote dashboard, a filterable/sortable library, an optional cross-module link to a local Show/Book, **owner-configurable Source Type & Category lists** (add/rename/delete/reorder in Settings), field-visibility settings, and a CSV importer — no external metadata API; shares only auth/profile and the app shell).
Medical (multi-year lab results + narrative reports; a trend Dashboard — inline-SVG sparklines + a lazy-recharts expanded chart, tracked-test picker, latest values by category; a searchable/filterable/sortable reports list; structured JSON/CSV import — no in-app OCR — with cross-provider unit normalization; drag-to-reorder display order (applied to the Dashboard, Report detail, and Entry form); field-visibility settings; Google-Drive-URL storage; a biometric/PIN lock; and a structured eye-refraction form; feature-complete; shares only auth/profile and the app shell).
Travel (trips as Days → Stops itineraries with a remembered-cities resolver; a filterable/sortable trip list; a Dashboard of places visited (China provinces/cities, world countries/cities) with an "N / 34" province progress; a Leaflet map with a layered shaded-region fill (China by province via DataV, other countries whole via Natural Earth); a per-trip Expenses layer — owner-configurable categories, a safe reimbursement-formula parser, per-currency + HKD totals via Frankfurter; field-visibility settings; and two Settings importers (wide CSV expenses, itinerary JSON trips); feature-complete; shares only auth/profile and the app shell).
