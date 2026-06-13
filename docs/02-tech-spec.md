# 02 — Tech Spec

## Stack

- **Frontend:** React + Vite + TypeScript (strict mode). Tailwind CSS. `vite-plugin-pwa` for
  install/offline. Recharts for charts.
- **Barcode:** `@zxing/library` (or `html5-qrcode`) decoding the device camera via `getUserMedia`.
  Requires HTTPS (provided by the host).
- **Backend-as-a-service:** Supabase — Postgres, Auth (Google OAuth), auto-generated REST, RLS.
- **Hosting:** Vercel / Netlify / Cloudflare Pages (any free tier; HTTPS automatic).
- **Food data:** USDA FoodData Central (search + nutrients, free data.gov key, ~1000 req/hr,
  public domain); Open Food Facts (barcode lookup, free).

## Suggested folder structure

```
src/
  components/        # shared, reusable UI only
  screens/           # one folder per screen/tab
  data/              # typed data-access layer (wraps supabase-js) — the ONLY db access
  lib/               # supabase client, units, dri, energy, met, food-api, off-api helpers
  constants/         # global constants (groups, nutrient keys, effort levels, colors map)
                     # activityIcons.ts maps icon name strings to named Tabler imports
  types/             # database.ts (generated), domain types
  hooks/
supabase/
  migrations/        # source-of-truth SQL migrations
docs/                # the spec bundle
```

## Data flow

UI (`screens` + `components`) → `data/*` repository functions → `supabase-js` query builder →
Supabase (Postgres + RLS). Components hold no SQL and never import the Supabase client directly.

## Auth & first-run

- Supabase Auth with the Google provider. (You'll create a Google OAuth client in Google Cloud and
  paste its ID/secret into Supabase → Authentication → Providers → Google.)
- On first successful login, if no `profile` row exists for `auth.uid()`, create one (seed defaults
  from `05-seed-data.md`, then let the user edit in Settings).

## Sync

Supabase is the single source of truth; all devices read/write it. Optional local caching is fine but
the cloud is authoritative (this also sidesteps iOS PWA storage eviction).

## Calculations (implement as pure helpers in `src/lib`)

- **BMR (Mifflin–St Jeor):**
  `BMR = 10*kg + 6.25*cm − 5*age − 161` (female); use `+5` instead of `−161` for male.
- **Energy (calorie) target:** `BMR × activityFactor` (default 1.4, adjustable later). Do not hardcode.
- **Activity energy (duration):** `kcal = MET × kg × hours`. Logged as a negative diary entry.
- **Activity energy (strength):** same formula `kcal = MET × kg × hours`, where MET is resolved from `activity.met_by_effort[session_effort]`. No hardcoded MET for strength activities.
- **Net energy:** `Net = Consumed − BMR − Activity`.
- **Nutrient scaling:** for a logged entry, `value = nutrientPerBasis × (amount × servingGrams) / basisGrams`, where basis is 100 g (`basisGrams = 100`) or one serving (`basisGrams = servingGrams`). Supplements typically use the per-serving basis.
- **Targets:** computed from profile using DRI tables for the user's age/sex (+weight where relevant).
  **Protein target** is overridden by `profile.protein_target_g` when set.
- **Upper limits / red bars:** each nutrient may carry a DRI upper limit (UL). If a reported value
  exceeds the UL, render its bar red. Bars otherwise use the neutral fill.
- **Units:** stored metric; convert at display only. `1 oz = 28.3495 g`, `1 lb = 453.592 g`,
  `1 inch = 2.54 cm`, `1 fl oz = 29.5735 ml`. kcal is unit-independent. In Imperial mode the
  food "per 100 g" basis is shown as "per 1 oz".

## External APIs

- **USDA FoodData Central:** search foods, fetch full nutrient profiles. Free API key from `api.data.gov`. When a USDA (or Open Food Facts) food is **favorited or logged**, cache a copy into the `food` table (with `source` and `external_id`) so Favorites/Custom and offline use work; plain search hits are not persisted.
- **Open Food Facts:** barcode → product + nutrients; free, global coverage (good for Asian packaged
  goods). Scanned products can be saved into Custom.

## Environment variables

`.env` (gitignored). Only `VITE_`-prefixed vars reach the browser.

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...     # public, RLS-respecting — safe in the client
VITE_USDA_API_KEY=...          # data.gov key
# service-role key is NEVER placed here or anywhere in the client
```

## Database workflow

Claude Code (via the Supabase MCP) designs the schema and generates types, but **schema changes ship as migration files** in `supabase/migrations/`, reviewed and applied by you with `supabase db push`.
RLS is enabled in the first migration for every table. Regenerate `src/types/database.ts` after each.

## Quality gates (run automatically)

Prettier, ESLint (no unused, no `any`), `tsc --noEmit`, and Vitest for the calculation helpers.
Wire them into a pre-commit hook and/or CI so they always run.
