# 02 — Tech Spec

## Stack

- **Frontend:** React + Vite + TypeScript (strict mode). Tailwind CSS (v4, CSS-first via
  `@tailwindcss/vite`). `vite-plugin-pwa` for install/offline. **React Router** (the unified
  `react-router` package) for routing + modal sheets. Recharts is installed but reserved for the
  Phase-2 net-worth trend (unused in Phase 1).
- **Barcode:** `@zxing/browser` (`BrowserMultiFormatReader`) + `@zxing/library` decoding the device
  camera via `getUserMedia`. Requires HTTPS (localhost is exempt for dev). The scanner is lazy-loaded
  so ZXing is a separate chunk, fetched only when scanning.
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
  lib/               # supabase client, units, dri, energy, met, nutrients, targets, report,
                     # date, food-api, off-api, food-search, diary-refresh, diary-clipboard helpers
  constants/         # global constants (groups, effort-levels, nutrient-sections, ranges,
                     # profile-defaults, seed-activities)
                     # activity-icons.ts maps icon name strings to named Tabler imports
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
  paste its ID/secret into Supabase → Authentication → Providers → Google.) The client is created
  once in `src/lib/supabase.ts` with **`flowType: 'pkce'`** set explicitly — the bare supabase-js
  client otherwise defaults to the implicit flow. A SPA needs no `/auth/callback` route;
  `detectSessionInUrl` exchanges the `?code=` on load.
- On first successful login, a client-side hook (`useEnsureProfile`) seeds the owner's data: it
  creates the `profile` row (defaults from `05-seed-data.md`) **and** seeds the owner's activity
  library (the activities in `05-seed-data.md`) if the user has none. Both are idempotent
  (insert-if-missing), guarded against React StrictMode double-invoke; not DB triggers. The user then
  edits in Settings.

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
- **Nutrient scaling:** for a logged entry, `value = nutrientPerBasis × (amount × servingGrams) / basisGrams`, where basis is 100 g (`basisGrams = 100`) or one serving (`basisGrams = the selected serving's grams`). Supplements typically use the per-serving basis; for a per-serving food the first/selected serving's grams define the basis.
- **Targets / DRI:** computed from profile via a lookup in `src/lib/dri.ts`. **Phase 1 populates only
  the owner's band — adult female 51–70** (the lookup is keyed by sex/age band; unsupported bands
  throw with a "add a band" message). **Protein target** is overridden by `profile.protein_target_g`
  when set, else the RDA. Nutrients with only an energy-percentage guideline get **energy-derived
  soft targets** computed from the day's energy target: `fat` (35% of kcal), `saturated` (10%),
  `added_sugars` (10%). `cholesterol`/`monounsaturated`/`polyunsaturated` have no target.
- **Upper limits / red bars:** each upper limit is **scope-tagged** (`total` | `cdrr` | `supplemental`
  | `guidance`). A bar turns red only when the value exceeds a limit whose scope is `total`, `cdrr`
  (sodium's chronic-disease-risk ceiling, 2300 mg), or `guidance` (e.g. added sugars > 10% kcal).
  Limits that apply only to supplemental/synthetic forms — magnesium (350), niacin (35), folic acid
  (1000), vitamin E (1000), preformed vitamin A (3000) — are stored for reference but **never** turn a
  food-intake bar red (a normal diet routinely exceeds them). Logic: `ulScope` in `src/lib/dri.ts` +
  `isOverUpperLimit` in `src/lib/nutrients.ts`.
- **Units:** stored metric; convert at display only via `src/lib/units.ts`. `1 oz = 28.3495 g`,
  `1 lb = 453.592 g`, `1 inch = 2.54 cm`, `1 fl oz = 29.5735 ml`. kcal/nutrient amounts are
  unit-independent. In Imperial mode, **Settings shows height in inches and weight in lb** (decimal);
  food nutrient amounts and the per-100 g basis are not re-expressed in imperial.

## External APIs

- **Called directly from the browser** (no server proxy): the USDA key is a `VITE_` var and Open Food
  Facts allows browser requests. Results are cached into `food` on favorite/log to limit calls.
- **USDA FoodData Central** (`api.nal.usda.gov/fdc/v1`): free `api.data.gov` key. **Search uses POST**
  `/foods/search` with a JSON body — the GET form 400s when `dataType` includes `"Survey (FNDDS)"`.
  `searchFoods` issues **two POST searches** — the whole-food databases
  (`Foundation`/`SR Legacy`/`Survey (FNDDS)`) and `Branded` — and merges them whole-foods-first.
  This is deliberate: a single combined search ranks the thousands of identical Branded exact-name
  products (8000+ for "blueberries") above every varied whole-food entry, so they'd be the only thing
  on the page. Branded duplicates (same name + brand) are then collapsed and capped. The UI sorts the
  merged list (with local foods) by name-match relevance, so search only needs to guarantee variety.
  USDA matches **whole tokens**, so a partial word ("blueberr") returns nothing; `searchFoods`
  therefore wildcards the last word at a stem (`food-search.ts#toUsdaWildcardQuery`: "blueberry",
  "blueberries", "blueberrie", "blueberr" → `blueberr*`) so partial/plural input all returns the same
  set. Over-broad recall is fine — the UI scorer re-filters to the typed term.
  Detail is `GET /food/{fdcId}`. Map nutrients on the stable INFOODS **`nutrient.number`** (e.g. 208
  energy kcal — not 268 kJ; 320 vitamin A µg RAE — not 318 IU; 435 folate µg DFE; 328 vitamin D µg;
  312 copper mg). USDA amounts are per 100 g. When a USDA (or OFF) food is favorited or logged, cache
  a copy into `food` (`source`, `external_id`); plain search hits aren't persisted.
- **Open Food Facts** (`world.openfoodfacts.org/api/v2/product/{barcode}.json`): free, global. **Every
  `*_100g` value is in grams** (including vitamins/minerals) → scale to our mg (×1000) / µg (×1e6).
  Sodium = `salt_100g / 2.5 × 1000` when `sodium_100g` is absent. All fields optional/sparse. Scanned
  products save into Custom.
- The **complete** nutrient mappings are the source of truth in code: USDA `nutrient.number` → our key
  in `src/lib/food-api.ts`, and Open Food Facts key → our key (with the per-field scale factor) in
  `src/lib/off-api.ts`. The owner-band DRI target/UL values are tabulated in `05-seed-data.md` and
  live in `src/lib/dri.ts`.

## Environment variables

`.env` (gitignored). Only `VITE_`-prefixed vars reach the browser.

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...     # public, RLS-respecting — safe in the client
VITE_USDA_API_KEY=...          # data.gov key
# service-role key is NEVER placed here or anywhere in the client
```

## Database workflow

**Schema changes ship as migration files** in `supabase/migrations/` (timestamp-prefixed,
`YYYYMMDDHHMMSS_name.sql`), reviewed and applied by you with `supabase db push` (remote-only — no
local Docker stack). RLS is enabled in the first migration for every table, **and migrations must
`GRANT` table privileges (select/insert/update/delete) to the `anon`/`authenticated` roles** — RLS
alone is insufficient because raw-SQL-migration tables don't inherit Supabase's default grants.
Enumerated TEXT columns use `CHECK` constraints (not Postgres enums); `updated_at` is maintained by
the `moddatetime` trigger. Regenerate `src/types/database.ts` (`npm run gen:types`) after each push.

## Quality gates (run automatically)

Prettier, ESLint (no unused, no `any`), `tsc --noEmit`, and Vitest for the calculation helpers.
Wire them into a pre-commit hook and/or CI so they always run.
