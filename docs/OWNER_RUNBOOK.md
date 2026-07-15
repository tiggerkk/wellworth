# OWNER RUNBOOK — stand up WellWorth from scratch

Every manual step to get WellWorth running locally and deployed, written for someone who has never
used these tools. Do the parts in order. Each part ends with a **✅ Check** so you know it worked
before moving on.

Notation: lines starting with `>` are commands you type into a terminal and press Enter. On Windows
use **PowerShell** (Start menu → type "PowerShell"). You run commands from the project folder unless
told otherwise.

You will create free accounts on: **Supabase**, **Google Cloud**, **api.data.gov** (USDA),
**themoviedb.org** (TMDB), **GitHub**, **Vercel**. The only thing that can cost money is the
Claude/Claude Code subscription used
to _build_ the app — running it is free.

---

## Part A — One-time tools on your computer

> **Opening PowerShell** (you'll use it throughout): click the Start menu, type `PowerShell`, and click
> **Windows PowerShell**. A blue/black window opens with a `>` prompt — that's where the commands below
> go. "Open a new PowerShell window" just means doing this again so it picks up newly-installed tools.

1. **Node.js** (the JavaScript runtime). Go to <https://nodejs.org> and click the big green button
   labelled **LTS** (Long Term Support) — **not** "Current". Run the installer with default options.
   - ✅ Check: open a **new** PowerShell window and run:
     ```
     > node -v
     ```
     You should see a version like `v20.x` or higher.

2. **Git** (version control). Download from <https://git-scm.com/download/win> and install with
   defaults.
   - ✅ Check: `> git --version` prints a version.

3. **The project folder.** If you were given a zip, unzip it. If it's on GitHub already, clone it
   (Part H explains git). Then, from inside the folder (it contains `package.json`):
   ```
   > npm install
   ```
   This downloads the app's dependencies into `node_modules` (takes a minute or two).
   - ✅ Check: `> npm run build` finishes with `✓ built in …` and no red errors. (It will warn that a
     chunk is large — that's fine.)

---

## Part B — Create the Supabase project (your database + login)

1. Go to <https://supabase.com>, sign up (the "Sign in with GitHub" option is easiest), and click
   **New project**.
2. Fill in: **Name** = `wellworth`; **Database Password** = generate a strong one and **save it
   somewhere you won't lose it** — a password manager is best; if you don't have one, Windows
   **Credential Manager** or even writing it on paper kept somewhere safe is fine. You'll need this
   password to run migrations, and there's no easy recovery if it's lost. **Region** = the one closest
   to you; Plan = Free. Click **Create new project** and wait ~2 minutes for it to provision.
3. In the project, open **Project Settings** (gear icon) → **API**. You need three values from here:
   - **Project URL** — looks like `https://abcd1234.supabase.co`.
   - **`anon` `public` key** — a long string under "Project API keys". This is safe to ship in the
     app (it respects row-level security).
   - **Project Ref** — the `abcd1234` part of the URL (also shown under Settings → General as
     "Reference ID").
     > ⚠️ There is also a **`service_role`** key on that page. **Never** use it or put it in the app —
     > it bypasses all security. We only ever use the `anon` key.

- ✅ Check: you have the Project URL, the anon key, and the project ref written down, plus the DB
  password saved.

---

## Part C — Get a free USDA food-database key

1. Go to <https://api.data.gov/signup>, enter your name + email, submit.
2. The API key is shown on the page and emailed to you. Copy it.

- ✅ Check: you have a ~40-character key. (Food _search_ won't work without it; everything else does.)

---

## Part C2 — Get a free TMDB (movie/TV database) key

Used by the **Shows** module to look up posters and metadata. Free, one signup.

1. Create an account at <https://www.themoviedb.org/signup> and verify your email.
2. Go to **Settings → API** (<https://www.themoviedb.org/settings/api>) → **Request an API key** →
   choose **Developer**, accept the terms, and fill in the short form (any personal use description is
   fine; URL can be `http://localhost`).
3. Copy the **API Key (v3 auth)** — a ~32-character string.

- ✅ Check: you have a v3 API key. (Shows _title search_ won't work without it; manual entry still does.)

---

## Part C3 — Get a free Google Books key (recommended)

Used by the **Books** module to look up covers and metadata. It's technically optional — Books search
works without it — but the **keyless quota is very low and rate-limits (HTTP 429) almost immediately**
in practice, so a key is recommended.

1. In the Google Cloud console (the **same project** as your Google sign-in is fine), go to **APIs &
   Services → Library**, search **Books API**, and **Enable** it.
2. **APIs & Services → Credentials → Create credentials → API key**, then configure it:
   - **Name**: anything, e.g. `WellWorth Books (browser)` — it's just a label. Do **not** check
     "Authenticate API calls through a service account" — a plain API key is correct (the search reads
     public data; a service account is the wrong credential type here).
   - **Application restrictions → Websites** (your app is browser JavaScript). Add your origins with a
     trailing `/*`: `http://localhost:5173/*` (local dev — match the port `npm run dev` prints), your
     LAN address if you test on the phone (e.g. `http://192.168.1.50:5173/*`), and your production URL
     (`https://your-app.vercel.app/*`). If you later get `403`s, an origin is missing — temporarily
     switch to **None** to confirm the key works, then re-add the right patterns. (For a solo app,
     leaving it on **None** with the API restriction below is also fine.)
   - **API restrictions → Restrict key → Books API.** A `VITE_` key ships in your browser bundle and is
     therefore **public**, so limiting it to this one free, read-only API caps any abuse.
3. Copy the key.

> ⚠️ Never put a **service-account / secret** key in a `VITE_` var — only this kind of restricted,
> public, read-only API key.

- ✅ Check: Books title search works, and with the key set you won't hit 429s on normal use.

> **Per-day quota (the other 429).** Even a correctly-configured key has a default **1,000
> `Queries per day`** on the project. A bulk CSV import is expensive: **each Chinese title costs 2
> queries** (the search runs Simplified + HK-Traditional), so a 32-book import ≈ 64 queries, and re-running the
> same file repeatedly (e.g. after `supabase db reset --linked` while testing) can exhaust the day's
> quota — you'll see a **429 that says `Queries per day`**. This is _not_ a config problem; it resets
> at **midnight US-Pacific**. To raise it: **APIs & Services → Books API → Quotas & System Limits**,
> filter "Queries per day", and request an increase. (The importer detects this flavour of 429,
> **stops** instead of retrying, and says so; unmatched rows still import as-is.)

---

## Part D — Create the `.env` file (your secrets, kept off the internet)

The app reads its configuration from a file named `.env` in the project root. It is intentionally
**not** committed to git. There's a template `.env.example` you can copy.

1. In PowerShell, from the project folder:
   ```
   > Copy-Item .env.example .env
   ```
2. Open `.env` in a text editor (e.g. Notepad: `> notepad .env`) and fill in the values from
   Parts B, C, C2, and C3. It should look like this (no quotes, no spaces around `=`):
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your-long-anon-key...
   VITE_USDA_API_KEY=your-usda-key
   VITE_TMDB_API_KEY=your-tmdb-v3-key
   VITE_GOOGLE_BOOKS_API_KEY=your-google-books-key
   VITE_ALLOWED_EMAILS=you@gmail.com
   VITE_OWNER_EMAIL=you@gmail.com
   ```
   - `VITE_SUPABASE_URL` — the Project URL from Part B.
   - `VITE_SUPABASE_ANON_KEY` — the anon public key from Part B.
   - `VITE_USDA_API_KEY` — the USDA key from Part C.
   - `VITE_TMDB_API_KEY` — the TMDB v3 key from Part C2.
   - `VITE_GOOGLE_BOOKS_API_KEY` — Google Books key from Part C3 (recommended; blank works but
     rate-limits quickly).
   - `VITE_ALLOWED_EMAILS` — optional email allowlist that keeps the app **yours** (see Part H3).
     Comma-separate multiple addresses (`you@gmail.com, partner@gmail.com`); leave blank for no
     restriction.
   - `VITE_OWNER_EMAIL` — **your** email: this account keeps the seeded owner profile and skips the
     onboarding wizard. Everyone else on the allowlist is treated as a family member (a neutral profile
     plus forced onboarding). If you leave it blank and the allowlist has exactly one address, that lone
     address is treated as the owner. Save and close.

- ✅ Check: `.env` exists with the four required lines filled (the Google Books line is optional but
  recommended). (These get baked into the app when it builds, so if you change them later you must
  rebuild/redeploy — and **restart `npm run dev`**, since Vite only reads `.env` at startup.)

---

## Part E — Install the Supabase CLI and link the project

The CLI is the tool that applies the database structure (migrations) to your Supabase project.

1. Install **Scoop** (a Windows installer helper), then the Supabase CLI. In PowerShell:
   ```
   > Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   > irm get.scoop.sh | iex
   > scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   > scoop install supabase
   ```
   > If `Set-ExecutionPolicy` asks to confirm, press `Y`. If Scoop is already installed, skip its two
   > lines. (Alternative if you'd rather not install: prefix every `supabase` command below with
   > `npx`, e.g. `npx supabase login`.)
2. **Open a new PowerShell window** (so it picks up the new `supabase` command), go back to the
   project folder, and log in + link:
   ```
   > supabase login
   ```
   This opens your browser to authorize — sign in to Supabase and approve.
   ```
   > supabase link --project-ref abcd1234
   ```
   Replace `abcd1234` with **your** project ref (Part B). If asked, enter the **database password**
   from Part B.
   > Note: the repo already contains `supabase/config.toml` and the migration files, so you do **not**
   > need to run `supabase init`. If a fresh clone somehow lacks `config.toml`, run `supabase init`
   > once first (it won't touch the existing `supabase/migrations/` folder).

- ✅ Check: `> supabase --version` prints a version, and `link` finished without an error.

---

## Part F — Apply the database migrations

This creates the tables, security rules, and the nutrient reference data in your Supabase project.

1. Make the database password available (so you aren't prompted each time). Easiest, persistent way —
   run once, then **open a new PowerShell window**:
   ```
   > setx SUPABASE_DB_PASSWORD "your-database-password"
   ```
   (This stores it for future sessions. It's saved in plain text in your Windows user profile —
   acceptable for a personal machine. If you'd rather not persist it, instead run
   `$env:SUPABASE_DB_PASSWORD = "your-database-password"` each session.)
2. Preview, then apply:
   ```
   > supabase db push --dry-run
   > supabase db push
   ```
   The CLI applies **every** file in `supabase/migrations/` — Wellness (`01_wellness_schema.sql` —
   creates `profile` incl. the global display prefs `units` + `font_size` (Dynamic Type preset), plus
   the Wellness tables; `02_wellness_seed_nutrient.sql`), Net Worth (`03_networth_schema.sql` — snapshots, asset entries +
   the insurance catalogue tables; `04_networth_profile_settings.sql` — the Net Worth `profile`
   columns), Shows, Books, Quotes (each a schema +
   a `profile` settings migration), **Medical** (`11_medical_schema.sql` — the three Medical tables;
   `13_medical_profile_settings.sql` — the Medical `profile` columns; `12_medical_seed_lab_test.sql` —
   the seeded lab-test reference), and **Travel** (`14_travel_schema.sql` — the five Travel tables;
   `15_travel_profile_settings.sql` — the Travel `profile` columns: `travel_expense_categories` +
   `travel_visible_fields`). You never list them yourself; whatever
   is in the folder is applied.

- ✅ Check (in the Supabase dashboard):
  - **Table Editor** shows the module tables: `nutrient`, `profile`, `food`, `serving`, `activity`,
    `diary_entry`, `strength_set`; the Net Worth pair `networth_snapshot`, `asset_entry`; `show`;
    `book`; `quote`; the Medical trio `medical_lab_test`, `medical_report`, `medical_result`; and the
    five Travel tables `trip`, `trip_day`, `stop`, `trip_expense`, `remembered_city`.
  - **SQL Editor** → `select count(*) from nutrient;` → **80**; `select count(*) from
medical_lab_test;` → the seeded reference count (the Medical Dashboard reads it).
  - **Advisors → Security** shows no "RLS disabled in public" warnings.

---

## Part G — Generate the TypeScript types

This regenerates `src/types/database.ts` from your live schema so the app's types match the database.
**Re-run this any time the schema changes.**

```
> npm run gen:types
```

- ✅ Check: the command finishes with no error and `src/types/database.ts` now lists your tables
  (e.g. it mentions `nutrient`, `profile`, `diary_entry`). Then `> npm run typecheck` passes silently.

---

## Part H — Set up Google sign-in (OAuth)

Two dashboards talk to each other here. The key idea: **Google needs to know your app's web address,
and Supabase needs Google's client ID + secret.**

### H1 — Google Cloud

1. Go to <https://console.cloud.google.com>, and create a project (top-left project picker → New
   project, name it `WellWorth`).
2. Left menu → **Google Auth Platform** (or visit
   <https://console.cloud.google.com/auth/overview>) → **Get started**:
   - **Audience:** External.
   - **Branding:** app name `WellWorth`, your support email.
   - **Data Access / Scopes:** ensure `openid`, `.../auth/userinfo.email`,
     `.../auth/userinfo.profile` are present (all "non-sensitive" — no Google review needed).
   - Under **Audience**, either add your own Gmail address as a **Test user**, or click **Publish app**
     (instant, since the scopes are non-sensitive).
3. Left menu → **Clients** → **Create client**:
   - **Application type:** Web application. Name: `WellWorth Web`.
   - **Authorized JavaScript origins:** add `http://localhost:5173` (you'll add the Vercel URL in
     Part K).
   - **Authorized redirect URIs:** add your **Supabase callback** —
     `https://abcd1234.supabase.co/auth/v1/callback` (use your project ref). The exact value is also
     shown on the Supabase Google page in H2.
   - Click **Create**, then copy the **Client ID** and **Client secret**.
     > Remember: JavaScript origins = where the _app_ runs (`localhost:5173`). The redirect URI = the
     > _Supabase_ callback, not your app.

### H2 — Supabase

1. In Supabase: **Authentication** → **Sign In / Providers** → **Google**. Toggle it **Enabled**,
   paste the **Client ID** and **Client secret** from H1, and **Save**.
2. **Authentication** → **URL Configuration:**
   - **Site URL:** `http://localhost:5173` for now (you'll change it to the Vercel URL in Part K).
   - **Redirect URLs:** add `http://localhost:5173/**` (keep this even after adding the Vercel one).
     > ⚠️ Use `localhost`, never `127.0.0.1` — they're different origins and only one is allow-listed.

- ✅ Check: the Google provider shows "Enabled" in Supabase. (You'll fully test sign-in in Part I.)

### H3 — Restrict who can sign in (so the app stays _yours_)

By default, once your Google consent screen is published, **any** Google account can sign in and
create its own account on your project. Row-Level Security still isolates data — a stranger never
sees _your_ rows — but they could create their own account and burn your free-tier quota. Three
**independent** layers close that door; using more than one is healthy defense-in-depth:

1. **Google OAuth audience — who Google lets through.** Google Cloud → **Google Auth Platform →
   Audience**:
   - **Testing**: only addresses you add under **Test users** can sign in; everyone else is blocked
     **by Google** before they reach your app. Best for a private app. (Cap: 100 test users; for our
     non-sensitive scopes there's no weekly token expiry to worry about.)
   - **In production / Published**: **any** Google account can complete sign-in. If you clicked
     "Publish app" in H1, you're here.
     → For a personal/family app, prefer **Testing** and add your own + family Gmail as **Test
     users**.
2. **Supabase sign-ups — whether a brand-new account is created.** Supabase → **Authentication →
   Sign In / Providers → "Allow new users to sign up"** (default **ON**). Turn it **OFF** once your
   own account(s) exist: existing users keep working, but a never-seen Google account can't create a
   new Supabase user. Flip it on for a minute when onboarding a family member, then off again.
3. **App-level email allowlist — the only layer visible in the repo.** Set **`VITE_ALLOWED_EMAILS`**
   (Part D locally; Part K in Vercel) to a comma-separated list of approved emails. The app signs
   out any signed-in account whose email isn't listed and shows "… isn't authorized to use this
   app." Leaving it blank means no restriction. Because it lives in the codebase (logic in
   `src/lib/access.ts`, enforced in `src/auth/AuthProvider.tsx`), it documents intent and keeps
   working even if a dashboard toggle later drifts.

> Remember `VITE_ALLOWED_EMAILS` (and `VITE_OWNER_EMAIL`) are **baked in at build time** — change them
> and you must redeploy (Part K) for production to pick it up, and restart `npm run dev` locally.

### Adding a family member

1. Add their Gmail to **`VITE_ALLOWED_EMAILS`** (Part D locally and Part K in Vercel), keeping
   **`VITE_OWNER_EMAIL`** set to your own address.
2. If you turned Supabase sign-ups **off** (step 2 above), turn them **on** for a minute so their
   brand-new account can be created, then turn them off again. Also make sure they're a Google OAuth
   **Test user** (step 1) if your consent screen is in Testing.
3. **Redeploy** (Part K) — these are build-time vars, so the change isn't live until the new build is.
4. They open the app, sign in with their own Google account, and are taken straight through the
   **onboarding wizard** to enter their own birthday/sex/height/weight. From then on their data is
   entirely separate from yours.

> Note: the DRI bands cover adult female & male aged 31 through 71+, so most family members get nutrient
> targets. Anyone **under 31** (or with a non-binary sex) won't see targets yet — everything else works.
> Adding a younger band is a small data edit in `src/lib/dri.ts` (see `PARKED.md`).

---

## Part I — Run the app locally

```
> npm run dev
```

Open the printed **Local** address — **<http://localhost:5173>** — in your browser. (The dev server
also prints a **Network** address like `http://192.168.1.118:5173/` — that's for testing on your
phone over Wi-Fi; see "Test on your iPhone over Wi-Fi" below.)

- ✅ Check, in order:
  1. You land on a **Sign in with Google** screen.
  2. Click it, complete the Google login, and you return to the app's **Diary** tab (no flash of the
     login screen).
  3. In Supabase **SQL Editor**, run `select * from profile;` — there is **one row** (your profile,
     pre-filled: birthday 1974-09-06, female, 171, 56, protein 90).
  4. The bottom tabs (Diary / Dashboard / Library / Settings) switch screens. In **Add Activity** (the
     Activities group's `+`) you see your seeded activities.
  5. In **Add Food**, search e.g. "egg" → results appear (this confirms the USDA key works).
  6. In **Shows → Library → New Show → Search TMDB**, type e.g. "matrix" → poster results appear (this
     confirms the TMDB key works).
  7. In **Books → Library → New Book → Search Google Books**, type e.g. "dune" → cover results appear
     (this works with or without the optional Google Books key).
  8. In **Quotes → Zen**, the **Shuffle** button rotates quotes (once you have some); **Library → New
     Quote** opens the entry form. No API key is needed — Quotes has no external service.
- To stop the dev server: press `Ctrl + C` in the terminal.

> Barcode scanning needs the camera, which browsers only allow over HTTPS. It works on your computer
> at `localhost` (desktop webcam); on a phone it works after deploying (Part K) or via an HTTPS tunnel
> (see below) — not over a plain LAN address.

### Test on your iPhone over Wi-Fi (no deploy needed)

Great for checking layout/UI changes on the real device without pushing to GitHub/Vercel.

1. Make sure the phone and computer are on the **same Wi-Fi** network.
2. Run `npm run dev` (the script uses `--host`, so it serves on your network too). Note the
   **Network** line it prints, e.g. `http://192.168.1.118:5173/`.
3. On the iPhone, open that **Network** URL in **Safari**. (Find your computer's address from the
   Network line — it can change when you reconnect to Wi-Fi. On Windows you can also run `ipconfig`
   and read the **IPv4 Address**.)
4. **Firewall:** the first time, Windows may ask to allow Node.js through the firewall — tick
   **Private networks** and allow it. If the page won't load and there was no prompt, the firewall is
   almost certainly blocking port `5173`.

Two limits over a plain LAN address (`http://…`, not HTTPS):

- **Google sign-in** only returns to allow-listed origins. To sign in from the phone, add your LAN
  address to **Supabase → Authentication → URL Configuration → Redirect URLs**
  (`http://192.168.1.118:5173/**` — use your actual IP); update it when your IP changes. (For pure
  layout checks you may not need to sign in.)
- **Camera (barcode) and "Add to Home Screen"** need HTTPS, so they don't work over a LAN address. To
  test those on-device without deploying, start a temporary HTTPS tunnel in a second terminal:
  ```
  > npx cloudflared tunnel --url http://localhost:5173
  ```
  Open the printed `https://…trycloudflare.com` URL on the phone (add it to the Supabase Redirect URLs
  too). This is a temporary public link, not a deploy.

---

## Part J — Put the code on GitHub

(Only needed for the Vercel deploy. If the project is already on GitHub and you cloned it, skip to
Part K.)

1. On <https://github.com/new>, create a **new empty** repository named `wellworth` (Private; do
   **not** add a README, .gitignore, or license — leave it empty).
2. In the project folder, connect it and push. Replace `<you>` with your GitHub username:
   ```
   > git add -A
   > git commit -m "WellWorth Phase 1"
   > git branch -M main
   > git remote add origin https://github.com/<you>/wellworth.git
   > git push -u origin main
   ```
   The first push will ask you to sign in to GitHub (a browser window opens).
   > Your secrets are safe: `.env` is git-ignored and is **not** uploaded. Only `.env.example`
   > (the blank template) is in the repo.
   > Same for your **Net Worth balances**: keep your real CSV as `templates/networth-seed.local.csv`
   > (git-ignored). Only the **sanitized** `templates/networth-seed-template.csv` is tracked. Never
   > commit a CSV with real values. To load them into the app, use **Net Worth → Monthly Entry →
   > Import CSV** (pick the month; re-importing replaces that month's manual assets, and also freezes
   > insurance + carries funds so the snapshot is complete — see `templates/networth-import-guide.md`).
   > **Funds** import from the JPM "My Portfolio" export saved as CSV via **Monthly Entry → Fund
   > section → import icon** (overwrites that month's funds; `templates/fund-import-guide.md`).
   > **Insurance** is a policy catalogue: one-time bulk-seed the wide sheet via **Net Worth → Settings →
   > Import CSV Insurance**, and add/update a single policy from **New Insurance / Edit Insurance →
   > Import Policy Schedule** (`templates/insurance-import-guide.md`). Keep the real `Insurance.csv` /
   > `Insurance.xlsx` and JPM exports git-ignored. (History note: real balances were once committed and
   > later purged from git history with a force-push — if you have an old clone, re-clone it so it
   > doesn't push the old history back.)
   > The same applies to your **Shows / Books / Quotes** lists: keep your real CSV git-ignored (e.g.
   > `quotes-seed-local.csv`), and load it in-app via that module's **Settings → Enable Bulk {Shows |
   > Books | Quotes} Import → Import CSV {Shows | Books | Quotes}** (idempotent — re-importing skips
   > duplicates). Only the sanitized `*-import-template.csv` files are tracked.

> **Optional — add quotes straight from Apple Books (iPhone/iPad).** Quotes has no API, so you add
> quotes by typing, pasting (the **Paste from clipboard** button on the New Quote form), the **CSV
> importer**, or an optional **Apple Shortcut**: in the Shortcuts app, make a share-sheet shortcut that
> takes selected text and **Opens URL**
> `https://<your-app>/quotes/entry?text=[Shortcut Input]&author=&title=` (URL-encode the text). Sharing
> a highlight from Apple Books to that shortcut opens the New Quote form pre-filled. (`?text=`,
> `?author=`, `?title=` all prefill.)

- ✅ Check: refresh your GitHub repo page — you see the project files (and a `docs/` folder), but
  **no `.env`**.

### Saving changes later (every time after the first push)

Whenever you (or Claude Code) change the code, save it to GitHub with these three commands from the
project folder:

```
> git add -A
> git commit -m "describe what changed"
```

The commit runs the quality gates automatically (format, lint, type-check, tests) — it takes a few
seconds. If it reports an error, the commit is **blocked**; fix the issue (or have Claude Code fix it)
and run the two commands again. Once the commit succeeds:

```
> git push
```

(You don't need `-u origin main` again — that was only for the first push.)

- ✅ Check: `> git status` prints `nothing to commit, working tree clean` and
  `Your branch is up to date with 'origin/main'`. If GitHub is connected to Vercel (Part K), the push
  **auto-deploys** the new version in a minute or two.

---

## Part K — Deploy to Vercel (so it runs on your phone)

1. Go to <https://vercel.com>, sign up with your GitHub account.
2. **Add New… → Project** → import the `wellworth` repository. Vercel auto-detects it as a **Vite**
   app (build command `npm run build`, output `dist`) — leave those defaults.
3. Expand **Environment Variables** and add the same ones from your `.env` (these get used at build
   time, so they must be set before deploying):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - `VITE_USDA_API_KEY` = your USDA key
   - `VITE_TMDB_API_KEY` = your TMDB v3 key
   - `VITE_GOOGLE_BOOKS_API_KEY` = your Google Books key
   - `VITE_ALLOWED_EMAILS` = your email allowlist (optional; see Part H3 — set it to keep prod
     restricted to you/family)
   - `VITE_OWNER_EMAIL` = your email (the owner account that skips onboarding; see Part H3)
4. Click **Deploy**. When it finishes, copy your app's address, e.g.
   `https://wellworth-xxxx.vercel.app`.
5. **Point Google + Supabase at the live address** (sign-in will fail until you do):
   - **Google Cloud → Clients → WellWorth Web → Authorized JavaScript origins:** add
     `https://wellworth-xxxx.vercel.app`. Save. (Leave the redirect URI as the Supabase callback.)
   - **Supabase → Authentication → URL Configuration:** set **Site URL** to
     `https://wellworth-xxxx.vercel.app`, and add `https://wellworth-xxxx.vercel.app/**` to
     **Redirect URLs**.

- ✅ Check: open the Vercel URL in a normal browser → Sign in with Google works → you reach the Diary.

> Future updates: because GitHub is connected, every `git push` to `main` auto-deploys. If you change
> `.env` values, also update them in Vercel → Project → **Settings → Environment Variables**, then
> **redeploy** so the new values get baked in:
>
> - In Vercel, open the project → **Deployments** tab → on the latest deployment click the **⋯** menu →
>   **Redeploy** → in the dialog **uncheck "Use existing Build Cache"** → **Redeploy**.
> - (A plain `git push` also triggers a fresh build, but after an env-var change the explicit redeploy
>   above is the reliable way to pick it up.)

---

## Part L — Install on iPhone / iPad

1. On the device, open the Vercel URL **in Safari** (must be Safari, not Chrome).
2. Sign in with Google once to confirm it works.
3. Tap the **Share** icon (the square with an up-arrow) → **Add to Home Screen** → **Add**.
4. Launch **WellWorth** from the home screen — it opens full-screen like a normal app, with the blue
   ring icon.

- ✅ Check: signed in, you can log a food and an activity, and the **barcode** button in Add Food
  opens the camera and scans a product (allow camera access when prompted).

---

## Part M — Resetting & re-seeding data

Three maintenance jobs: **M1** wipes + rebuilds everything, **M2** refreshes the starter activities,
and **M3** resets one module's data while leaving the others intact.

Seed data by module:

- Only **Wellness** has seed data: the owner's **profile** + **activity library** are re-seeded on the
  next sign-in (idempotent — only when that data is missing), and the **nutrient** reference table is
  seeded by a migration (not on login).
- **Net Worth, Shows, Books, Quotes, and Travel have no seed data** (the **Medical** `medical_lab_test`
  reference is migration-seeded) — their tables (`networth_snapshot`/`asset_entry`, `show`, `book`,
  `quote`, and the Travel five `trip`/`trip_day`/`stop`/`trip_expense`/`remembered_city`) come back
  **empty** after a reset and are filled entirely by you in the app.

> ⚠️ These act on your **live** Supabase project. There is no undo. Make sure you mean it.

### M1 — Completely reset the database (wipe + rebuild from migrations)

Use this to get a pristine database matching the migration files (e.g. after consolidating
migrations, or to clear all test data). It **drops everything and replays the migrations**, so all
foods, activities, and diary entries are erased.

> 💾 **Take a backup first** if the project holds real data — `npm run db:backup` (Part Q). A reset is
> irreversible, and unlike Vercel there's no free-tier snapshot to fall back on.

From the project folder (the database password must be available — see Part F):

```
> supabase db reset --linked
```

Confirm at the prompt. The CLI re-runs **every** file in `supabase/migrations/` — currently the 17
files from `01_wellness_schema.sql` through `17_literature_profile_settings.sql` (Wellness, Net Worth,
Shows, Books, Quotes, Medical, Travel, and Literature schema + settings + seed migrations) — against the
remote, leaving a clean schema + the 80 nutrient rows + the seeded `medical_lab_test` reference, and a
migration-ledger that matches the files.
(You never list them yourself; the CLI applies whatever is in the folder, so new migrations are picked
up automatically.)

- ✅ Check:
  1. `> supabase migration list` shows the same migrations locally and remotely.
  2. **Sign out, then sign back in** → you land on the Diary; your **profile** and the **activity
     library** have been re-seeded; SQL `select count(*) from nutrient;` returns **80**.

> **You must sign out first.** A full reset deletes the auth users too, but the browser still holds the
> old login (a cached token in `localStorage`), so reloading — even after closing/reopening the browser
> — keeps you "logged in" against a user that no longer exists, and the app shows **"Couldn’t load your
> profile."** Go to the Home-hub **gear → Settings → Account → Sign out** (that card is always
> available, even when the profile fails to load), which clears the cached token and reloads to the
> login screen. Then sign in with Google — a fresh profile + activities are created on first login. (If
> you ever need to clear it by hand: DevTools → Application → Local Storage → delete the
> `sb-…-auth-token` key, then reload.)
>
> ⚠️ **If you locked down sign-ups (Part H3), re-enable them before signing back in.** The reset
> deletes your own `auth.users` account, so your next Google sign-in is treated as a **new signup** — and
> if **"Allow new users to sign up" is OFF** it's **blocked** (the app loops back to login with
> `?error=access_denied&error_code=signup_disabled`). Fix: Supabase → **Authentication → Sign In /
> Providers → enable "Allow new users to sign up"**, sign in once to recreate your account, then turn it
> **off** again. (`VITE_ALLOWED_EMAILS` still gates who's admitted.)

### M2 — Re-seed activities after changing `seed-activities.ts`

The starter activities live in `src/constants/seed-activities.ts` and are seeded **once**, only when
you have **zero** activities (`ensureOwnerActivities` is a no-op otherwise). So after you edit that
file (new activities, changed METs/durations), you must clear the existing rows, then sign in again —
no full reset needed, and your foods and diary history are kept. (Activities are the **only**
client-seeded library; Net Worth, Shows, Books, and Quotes have no starter data, so there's nothing to
re-seed for them.)

1. In **Supabase → SQL Editor**, run:
   ```sql
   delete from public.activity;
   ```
   (Single-user database, so this clears them all. Diary entries that referenced an activity keep
   their saved snapshot — name, energy — and their `activity_id` simply becomes null.)
2. **Reload the app** (or sign out and back in). `ensureOwnerActivities` re-seeds the updated set.
   The seed is baked into the app bundle, so make sure the app you reload is **running the new code** —
   for the installed iPhone app, `git push` to deploy first (Part J/K); for local testing, the
   `npm run dev` server already has it.

- ✅ Check: Library → **Activities** shows the new list; opening one in **Add Activity** prefills the
  duration/effort you set in the seed file.

> If you'd also added custom activities of your own, the delete removes those too — re-create them
> afterwards. To keep them, delete only the seeded rows by name instead of the whole table.

### M3 — Reset one module's data only (keep the other modules)

Use this to start a module clean — test it, wipe just its tables, then enter real production data —
without touching the others (e.g. reset Wellness and go live on it while Net Worth, Shows, Books,
Quotes, Medical, and Travel stay as they are). Run the SQL in **Supabase → SQL Editor** (Dashboard →
**SQL Editor** → **New query** → paste → **Run**). It edits **data only** — never the schema or the
migrations.

> ⚠️ The SQL Editor runs with full privileges (it bypasses row-level security), so `truncate` wipes
> **all** rows in those tables — on a solo project that's exactly your data. `cascade` also clears the
> dependent child rows (strength sets, servings, asset entries, insurance schedule versions + points,
> medical results, and Travel days/stops/expenses). There is no undo.
>
> **Views need nothing.** `networth_monthly_type_total` and `medical_latest_result` are **views** over
> their base tables, not tables — they refresh automatically once the underlying rows are wiped, so they
> never appear in a `truncate`.

> Note: every table's primary key is a **random UUID** (`gen_random_uuid()`), not an auto-increment
> counter, so there's no "id sequence" to reset — IDs don't go back to 1; new rows just get fresh
> UUIDs. (That's why the commands use plain `truncate … cascade`, not `restart identity`.)

**Wellness** — wipes foods, servings, activities, diary entries, and their strength sets:

```sql
truncate public.diary_entry, public.strength_set, public.food, public.serving,
         public.activity cascade;
```

This keeps the `nutrient` reference table and your `profile`. After running it, **reload the app**:
`ensureOwnerActivities` sees zero activities and re-seeds the starter **activity library** (your
production starting point); foods and diary start empty. Your `profile` (identity, units, protein
target, nutrient visibility) is the **shared account row** and is left as-is — adjust it in the app's
**Settings** if you want, rather than here.

**Net Worth** — wipes every monthly snapshot + its asset entries **and** the insurance-policy catalogue:

```sql
truncate public.networth_snapshot, public.asset_entry,
         public.insurance_policy cascade;
-- optional: also reset the Net Worth settings on your profile to defaults
update public.profile
  set networth_visible_asset_types          = null,
      networth_asset_type_order             = null,
      networth_bulk_insurance_import_enabled = true,
      insurance_providers                   = null;  -- null = the seed providers (CHUBB/BOC/Manulife)
```

> Two independent parents here, so both must be listed: `networth_snapshot` cascades to `asset_entry`
> (the monthly holdings — including funds, which are `asset_entry` rows of `asset_type = 'fund'`, not a
> separate table), and `insurance_policy` cascades to its `insurance_schedule` versions → their
> `insurance_schedule_point` rows. The **insurance catalogue is per-user reference data, not per-month**:
> each month's `insurance` holdings are frozen into `asset_entry` from it at save time. So wiping only
> the snapshots would leave the catalogue behind and it would re-freeze insurance rows into the next
> month you save — include `insurance_policy` for a true from-scratch Net Worth reset. (To keep your
> policies and clear only the monthly figures, drop `public.insurance_policy` from the command.)

**Shows** — wipes every tracked title:

```sql
truncate public.show cascade;
-- optional: also reset the Shows settings on your profile to defaults
update public.profile
  set show_visible_fields = null,
      show_importer_enabled = true,
      show_poster_url_visible = false;
```

> **Schema changes are folded into the existing migration files** (the media tables hold no precious
> data; you refresh with `supabase db reset --linked`). Because `supabase db push` won't re-run an
> already-applied migration, apply edits with a full reset: **`supabase db reset --linked`** re-runs
> every migration from scratch (wipes all modules), then run **Part G** (`npm run gen:types`) so
> `src/types/database.ts` matches.
>
> ⚠️ **`supabase db reset --linked` also wipes `auth.users` — it deletes your own account.** If
> **"Allow new users to sign up" is OFF** (Part H3, the recommended lockdown), your next Google
> sign-in is treated as a _new signup_ and is **blocked** — the app loops back to "Sign in with
> Google" (the redirect carries `?error=access_denied&error_code=signup_disabled`). **Fix:** Supabase
> → **Authentication → Sign In / Providers → enable "Allow new users to sign up"**, sign in once to
> recreate your account, then turn it **off** again. (The `VITE_ALLOWED_EMAILS` allowlist still gates
> who's admitted.)

**Books** — wipes every tracked book:

```sql
truncate public.book cascade;
-- optional: also reset the Books settings on your profile to defaults
update public.profile set book_visible_fields = null, book_importer_enabled = true;
```

**Quotes** — wipes every quote:

```sql
truncate public.quote cascade;
-- optional: also reset the Quotes settings on your profile to defaults
update public.profile
  set quote_visible_fields   = null,
      quote_importer_enabled = true,
      quote_source_types     = null,  -- null = the seed Source Type list in src/constants/quotes.ts
      quote_categories       = null;  -- null = the seed Category list in src/constants/quotes.ts
```

> Quotes' optional `show_id`/`book_id` links are `ON DELETE SET NULL`, so wiping Shows/Books only nulls
> those columns on surviving quotes (the denormalised author/title/source type stay). Wiping `quote`
> never touches `show`/`book`.

**Medical** — wipes every report and its results (the `medical_lab_test` reference is kept):

```sql
truncate public.medical_report, public.medical_result cascade;
-- optional: also reset the Medical settings on your profile to defaults
update public.profile
  set medical_tracked_tests        = null,
      medical_section_order        = null,
      medical_test_order           = null,
      medical_visible_fields       = null,
      medical_importer_enabled     = true,
      medical_lock_enabled         = false,
      medical_lock_pin_hash        = null,
      medical_lock_webauthn_id     = null,
      medical_lock_timeout_minutes = null;
```

> `medical_report` cascades to `medical_result`, so listing both is just explicit. The
> `medical_lab_test` reference table is **migration-seeded** (like `nutrient`) and read-only to clients —
> leave it; it isn't user data. The optional `update` reverts the Medical preferences on your shared
> `profile` row: `medical_tracked_tests = null` falls back to the seeded `default_tracked` set, the order
> /visible-field overrides clear, the importer returns to its default-on state, and the **biometric
> lock** is cleared — that last part also wipes a **forgotten Medical PIN** (the salted hash), an
> alternative to the sign-out reset in Part O.

**Travel** — wipes every trip (days, stops, and expenses cascade) + the remembered-cities cache:

```sql
truncate public.trip cascade;          -- cascades trip_day → stop, and trip_expense
truncate public.remembered_city cascade;
-- optional: also reset the Travel settings on your profile to defaults
update public.profile
  set travel_expense_categories = null,  -- null = the seed category list in src/constants/travel.ts
      travel_visible_fields     = null,  -- null = all Trip-form fields visible
      travel_importer_enabled   = true;
```

- ✅ Check: open that module in the app — its lists are empty (Wellness shows the re-seeded starter
  activities after a reload), and the **other** modules' data is untouched.

> **Multi-user note (future household project):** `truncate` clears every user's rows. To scope a wipe
> to **yourself**, instead run `delete from <table> where user_id = '<your-user-id>';` on each module's
> **own** tables — `activity`, `food`, `diary_entry` (Wellness) / `networth_snapshot` +
> `insurance_policy` (Net Worth) / `show` / `book` / `quote` / `medical_report` (Medical) / `trip` +
> `remembered_city` (Travel) — and the child rows (`serving`, `strength_set`, `asset_entry`,
> insurance's `insurance_schedule` → `insurance_schedule_point`, `medical_result`, and Travel's
> `trip_day`/`stop`/`trip_expense`) cascade automatically. The insurance child tables carry no `user_id`
> of their own (they're owned via the policy), so per-user scoping must go through `insurance_policy`.
> Your user id is in **Supabase → Authentication → Users**.

---

## Part N — Logging a new show (the Shows workflow)

The Shows module covers TV, movies, and **documentaries** (incl. Chinese titles and Chinese
documentaries / CCTV series). To add one (**Shows → New Show**):

1. **Search TMDB** in the New Show form — works for any title; a **Chinese (CJK) query returns Chinese
   titles**. For a documentary, set Type → **Documentary** first (it searches TMDB's TV catalogue). If a
   documentary belongs to a parent series, just fold the series into the **Title** yourself (e.g.
   `国宝档案 — 从东晋到北魏`).
2. **Found → select** → metadata + poster auto-fill → set status / rating / **♥ favourite** / etc. →
   **Save**. Done. (A new show defaults to **Want** with a blank Start Date; pick Watching/Watched and
   the Start Date defaults to today.)
3. **Not found** (common for niche documentaries), choose one:
   - **(Preferred, durable) Contribute to TMDB:** create the entry at themoviedb.org (title, episode
     count, upload a poster). It may take from minutes to a day or two to clear moderation. Either log the
     show now poster-less and **Refresh from TMDB** once it appears, or wait and then Search TMDB.
   - **(Immediate) Manual entry + paste a Poster URL:** the **Poster URL** field is **off by default** —
     turn it on once in **Shows Settings → Visible Fields → Poster URL**. Then type title / status /
     rating, and on Douban or the streaming page **Copy Image Address** and paste it into the field.
     Saves instantly; rendered via `no-referrer`. (Prefer a streaming-site `og:image` or TMDB URL over a
     Baidu/Douban _search_ URL — those can expire.)
4. **⟳ Refresh from TMDB** (the button beside Search; enabled once a `tmdb_id` exists): use it when your
   contributed entry clears moderation, or when a show adds seasons/episodes. It updates TMDB-sourced
   fields only and **never** overwrites your status, rating, dates, notes, favourite flag, or a
   manually pasted poster. (Bulk "refresh everything" is intentionally not built — see `PARKED.md`.)

**Bulk import:** to seed a back-catalogue, enable **Shows Settings → Enable CSV import** and use one CSV
spanning English + Chinese across all three types — see `templates/shows-import-guide.md`.

---

## Part O — Logging a medical report (the Medical workflow)

The Medical module trends lab results over the years and keeps narrative reports (MRI, imaging, eye).
Originals are **not** uploaded — you keep Google Drive links. Extraction happens **outside** the app
(the app does no OCR), because a vision AI reads decimals accurately where OCR mangles them.

1. After you receive a report PDF, save the file to **Google Drive** and copy its share link(s).
2. Open any vision-capable AI tool (Claude, Gemini, GPT, …), upload the PDF, and paste the prompt from
   `templates/medical-extraction-prompt.md`. Save the output as `YYYY-MM-DD_<type>.json`. (The JSON
   shape + a CSV alternative are in `templates/medical-import.schema.json`; a sanitized example is
   `templates/medical-import-template.json`.)
3. **Spot-check the JSON** against the PDF — especially decimals (LDL / HDL / glucose / creatinine) and
   that no section was skipped (bone density, BMI, vitals, imaging findings). Fix any `uncertain` rows.
4. First time only: in **Medical → Settings**, turn on **Enable structured import**. Then open the
   importer from there (**Import JSON / CSV Medical**) or the **Import** button on the New-Report form.
5. Choose the file. The importer auto-repairs the known AI glitch (a stray quote after a number),
   normalizes provider names + units, and shows a **review screen** (counts by category, so a missing
   group is obvious). Correct/add anything, set type / date / provider, paste the **Drive link(s)**,
   and **Save**. Re-importing the same date+type replaces it (no duplicates).
6. Manual entry is always available for a single value or a screening the PDF doesn't cover.
7. **Lock (optional):** in **Medical → Settings → Security → Lock**, set a **PIN** (4–8 digits) to gate
   the module; on a supported device you can also turn on **Face ID / Touch ID** as a faster unlock
   (the PIN always works as the fallback). Pick the **auto-lock** timeout (default: after 5 min; it also
   always re-locks when the app is restarted). The lock guards this device — your data is already
   private to your account. If you ever forget the PIN, use **Sign out** on the lock screen, sign back
   in, and reset it (you stay signed in within a session, so you won't be locked out mid-use).

> **Privacy:** your extracted JSONs (`templates/medical-import-20*.json`) and report PDFs contain your
> name / HKID / DOB and are **gitignored** — they never go into the repo. Only the prompt, the schema,
> and the sanitized template are tracked.

---

## Part P — Logging a trip (the Travel workflow)

The Travel module logs trips as day-by-day itineraries, maps the places you've been, and tracks per-trip
spend. No API key is needed (the map + geocode + FX are all keyless).

1. **New Trip** → name, status (Want / Planning / Visited), base currency; **Create**. Then add the rest
   in the builder: optional cover image URL, companions, rating, notes, and (if you'll track it) the
   **Track Reimbursement** toggle.
2. **Itinerary**: **Add Day**, give each day a **date** (tap the calendar chip), and **Add Stop** inline —
   pick a type (Travel / Visit / Eat / Shop / Stay / Other), choose the **city** (known cities fill
   country/province instantly; a new city offers an optional **Look up online** or manual entry + pin,
   then is remembered), and fill the type's fields. Drag to reorder; mark **Done/Skipped** (your
   "didn't go" items become Skipped, not deleted). A stop's Cost is just a note — it's never summed.
3. **Expenses** (the real spend): add expenses as you go, or one-time **Settings → Import CSV Expenses**
   (a wide sheet with a **Trip** column + the category columns + **Cost** / **Re-imbursed**). Turn on
   **Track Reimbursement** where needed; Reimbursed accepts a number or a formula (`amount/2`,
   `amount/5*2`). Each trip shows its **HKD total** (first-day FX); if a currency can't be priced
   automatically, type its rate in the trip's **Conversion to HKD** card.
4. **Bulk-load old trips (one-time):** prefix each trip's text with
   `=== TRIP: <name> | <YYYY-MM> | <status> ===`, paste them all into any AI tool with
   `templates/travel-prompt.md`, save the JSON array, then **Settings → Import JSON Trips** →
   review (confirm any new cities once) → **Import**. The result is drafts you finish in the Trip Builder;
   expenses import separately.
5. The **Dashboard** counts (provinces / cities / countries) and the **Map** update automatically from
   your **Visited** trips.

> **Privacy:** your real trip/expense files (`travel-expenses*.csv`) are **gitignored**; only the
> sanitized templates + the travel prompt/schema are tracked.

---

## Part Q — Backups & disaster recovery

The Supabase **free tier has no automatic backups**, and it **pauses a project after ~7 days of
inactivity** (and can delete it after a long pause). Your data — **medical lab results** and **net-worth
financials** especially — is irreplaceable, so you run your own **encrypted, off-site backups**, and a
lightweight **keep-alive** so the project never pauses.

What's protected, and what isn't:

- **Schema is already safe** — every table is defined in `supabase/migrations/`, in git. The reference
  tables `nutrient` and `medical_lab_test` are seeded by migrations too. So the backup only needs your
  **entered data** (it skips those two reseeded tables) — it's tiny.
- **The backup also captures `auth.users` + `auth.identities`.** This is the part most guides miss:
  every row is owned by your auth **UUID**. If you ever recreate the project from scratch, signing in
  again would mint a _new_ UUID and your restored rows would be invisible (RLS). Backing up the auth
  identity lets a fresh project re-link your Google login to the **same** UUID. See Q4.

> 🐚 **Shell note for this Part:** the local backup/restore commands below run in **Git Bash** (they use
> Unix `export VAR='…'` syntax), **not** PowerShell. Throughout this runbook a `$` prompt = Git Bash and
> a `>` prompt = PowerShell. Git Bash was installed with Git in Part A — open it from the Start menu
> ("Git Bash") or right-click the project folder → "Git Bash Here". The one-time setup steps below are
> all in the GitHub/Supabase web UI, so they're shell-independent.

### Q1 — One-time setup

1. **Create a private backups repo** on GitHub, e.g. `wellworth-backups` (Private). Nothing else goes
   in it — just the encrypted dumps.
2. **Make an age key** (encryption). Install age (`winget install FiloSottile.age`, or scoop/brew),
   then:
   ```
   > age-keygen -o wellworth-backup.key
   ```
   It prints a **public key** (`age1…`) — copy it. **Keep the file `wellworth-backup.key` (the private
   key) offline** — in your password manager / a USB key, **never in any repo or `.env`**. If you lose
   it, every backup is unreadable. (The CI runner only ever gets the _public_ key, so it can encrypt but
   never decrypt.)
3. **Get the Session-pooler connection string.** Supabase → Settings → Database → **Connection string**
   → **Session pooler** → URI, and paste your DB password in. It looks like
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. Use the
   **Session** pooler (not the `:6543` transaction pooler — `pg_dump` needs a session; and not the
   direct `db.<ref>…` host, which is IPv6-only and unreachable from GitHub's runners).
4. **Make a fine-grained PAT** for the backups repo: GitHub → Settings → Developer settings →
   Fine-grained tokens → only `wellworth-backups`, **Repository permissions → Contents: Read and write**.
5. **Add the secrets** to **this** repo: Settings → Secrets and variables → **Actions** → New secret:
   - `SUPABASE_DB_URL` = the Session-pooler URI from step 3
   - `AGE_PUBLIC_KEY` = the `age1…` public key from step 2
   - `BACKUPS_REPO` = `your-github-username/wellworth-backups`
   - `BACKUPS_REPO_TOKEN` = the PAT from step 4
   - _(optional)_ `SUPABASE_URL` + `SUPABASE_ANON_KEY` to enable the extra REST keep-alive ping.

### Q2 — The automated backup (and keep-alive)

`.github/workflows/backup.yml` runs **every ~3 days** (and on demand). It dumps the DB through the
session pooler, encrypts the dump to your age public key, and pushes `backups/wellworth-<timestamp>.sql.age`
to your private backups repo (keeping the newest 60 in the tree; git history holds the rest). Because the
dump is a real database connection, **it doubles as the keep-alive** — the project stays active, so it
won't pause. Run it now to verify: **Actions → DB backup & keep-alive → Run workflow**, then check a new
`.age` file appears in `wellworth-backups`.

> ⚠️ **GitHub disables scheduled workflows after 60 days of no repo activity.** While you're actively
> committing, that never triggers. If you ever go quiet for two months, re-enable it from the **Actions**
> tab. Also: "what counts as activity" for the pause is Supabase's call — if they change it, verify a
> manual run still un-pauses the project.

### Q3 — Manual backup (before anything risky)

The simplest manual backup is just **Actions → Run workflow** (no local tools needed). **Always take one
before a `supabase db reset --linked`** (Part M) or any destructive migration.

To back up **locally/offline** instead (needs `age` + the v17 `pg_dump` on PATH), from the project folder
in Git Bash:

```
$ export SUPABASE_DB_URL='postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres'
$ export AGE_PUBLIC_KEY='age1…'
$ npm run db:backup        # writes backups/wellworth-<timestamp>.sql.age (gitignored)
```

### Q4 — Restoring (two tiers)

You need `age` + `psql` locally and your **private** age key file. **Always dry-run into a throwaway DB
first** (`supabase start` for a local one) and compare row counts before trusting a backup.

- **Tier 1 — same project (routine):** the project still exists, you just lost/corrupted data. Point at
  the live DB and load the latest backup — your UUIDs are unchanged, so everything reappears:
  ```
  $ export TARGET_DB_URL='…session-pooler URI of the live project…'
  $ export AGE_KEY_FILE='/path/to/wellworth-backup.key'
  $ npm run db:restore -- backups/wellworth-<timestamp>.sql.age
  ```
- **Tier 2 — project deleted (disaster):** create a **new** Supabase project (Part B), then:
  1. `supabase link --project-ref <new-ref>` and `supabase db push` (rebuilds the schema from
     migrations + reseeds `nutrient`/`medical_lab_test`).
  2. **Before signing in for the first time**, run the restore (above) against the new project — this
     loads `auth.users` + `auth.identities` with their original UUIDs.
  3. Update `.env` + Vercel + Google OAuth redirect/origin URLs for the new ref + anon key; `npm run
gen:types`.
  4. Sign in with the **same** Google account — it re-links to the restored identity, so your UUID (and
     all your data) matches.

### Q5 — Why this order of priorities

A **paused** project you can un-pause from the dashboard in seconds; a **deleted** one is gone. So the
**encrypted backup is the real insurance** and the keep-alive is just convenience. Even total loss is
recoverable: new project → migrations → restore. The one thing you must never lose is the **age private
key** — guard it like the DB password.

---

## Part R — Browser storage & when to clear it ("Delete data")

When a code change tells you to **"Delete data"** / **"Clear site data,"** it's almost always to drop **stale cached app code** (see "cached assets" below) — _not_ to wipe your real data. Knowing the difference saves you from needless logouts.

### R0 — Three separate places your stuff lives

| Layer                      | Holds                                                                                                                   | Lives                        | Cleared by `supabase db reset` / truncate? | Cleared by "Delete data"?    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------ | ---------------------------- |
| **Supabase database**      | Your actual data — every show, book, diary entry, trip, medical result                                                  | Supabase's servers (cloud)   | **Yes** (that's what those commands do)    | No (it's not in the browser) |
| **Browser `localStorage`** | Small client state: login token, last-opened module, the **book / show / food import match caches, Liquid Only toggle** | This browser, on this device | **No** — survives every DB reset           | Yes                          |
| **Browser PWA cache**      | "Cached assets" — copies of the **app's own files** for offline use (see R3)                                            | This browser, on this device | No                                         | Yes                          |

**`localStorage`** is a tiny key→value store built into every browser, kept on disk per **origin** (`http://localhost:5173` and `https://<your-app>.vercel.app` each get a _separate_ one) and per browser/device. It is **completely independent of the database**: truncating `book` or running `supabase db reset --linked` (Part M) never touches it — which is exactly why the import match cache keeps working across your test resets.

### R1 — The two ways to clear it (both are the "nuclear" option)

Both wipe **all** browser storage for that origin (everything in the two browser rows above):

1. **Info icon** (the tune/🔒 icon just left of the address bar) → **Site settings** → under **Usage**, **Delete data**.
2. **F12** (DevTools) → **Application** tab → **Storage** (left sidebar) → **Clear site data**.

They're equivalent. Do this on the right origin — localhost vs your Vercel URL are independent.

### R2 — What "Delete data" wipes, and the effect on the app

| Gets wiped                                                            | Effect                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Supabase auth token (`localStorage`)                                  | **You're logged out** → sign in with Google again                                                 |
| Last-opened module (`localStorage`)                                   | App reopens at the Home hub instead of your last module                                           |
| Book / show / food import match caches (`localStorage`)               | Next CSV import re-queries Google Books / TMDB / USDA (book cache also re-spends the daily quota) |
| Net Worth Liquid Only toggle (`localStorage`)                         | Resets to off                                                                                     |
| Search / filter / sort state (`sessionStorage`)                       | List screens reset to defaults                                                                    |
| Net Worth Monthly Entry Asset Type expansion state (`sessionStorage`) | Asset Type sections are expanded if >= 1 item                                                     |
| **Cached assets** + service worker (PWA cache)                        | App re-downloads its files on next load (a beat slower once)                                      |
| Cookies                                                               | Any other site cookies for the origin are cleared                                                 |

Your **shows, books, entries, etc. are untouched** — they're in the database, not the browser.

### R3 — What "cached assets" actually are

The app is a PWA: a **service worker** precaches the app's **own static files** so it loads offline and
fast. These are the "cached assets":

- The app's compiled **code + styles** (JS bundles, CSS) and **`index.html`**.
- **App icons / fonts** and the offline shell.
- The **Travel map's base data** — the bundled `world-countries.geojson` / `china-provinces.geojson`
  (Leaflet tiles themselves come from the network, not this cache).

They are **not** your data. In particular, **matched shows and matched books are _data_**, stored as rows in the **Supabase database** — they're not "cached assets." The only match data kept in the browser is the **import match caches** in `localStorage` (R5) — `wellworth:books-match-cache`, `wellworth:shows-match-cache`, and `wellworth:food-match-cache` — which exist purely to speed up re-imports (and, for books, save the daily Google Books quota), and also `wellworth:networth-liquid-only` - which is the Liquid Only toggle.

### R4 — When you actually need to "Delete data"

- **After a deploy/code change, the app looks stale or broken on a device** (old screen, a fixed bug
  still showing, a white screen) — the service worker is serving the **old cached assets**. This is the
  main legitimate reason. _Tip:_ a hard reload or closing all tabs often suffices; "Delete data" is the
  sure fix. (For the installed iPhone PWA, see Part L / the deploy notes.)
- **A migration changed the shape of stored client state** and the app misbehaves on old values.
- You're **deliberately testing first-run / logged-out** behavior.

You do **not** need it for ordinary data changes, after a DB reset, or just to clear the import cache —
use R5 for the cache, and re-login is never required for those.

### R5 — Clearing one thing instead of everything

To drop just an **import match cache** without logging out:

- **In the app:** the module's **Settings → Import → "Clear Import Match Cache"** — **Books** (Google
  Books matches), **Shows** (TMDB), or **Wellness** (USDA food matches). (Recommended — one tap, stays
  logged in.)
- **In DevTools, per-key:** F12 → **Application** → **Storage → Local Storage** → click your origin → you'll see individual rows (`wellworth:books-match-cache`, `wellworth:shows-match-cache`, `wellworth:food-match-cache`, `wellworth:last-module`, `wellworth:networth-liquid-only`, the `sb-…-auth-token`). Select a single row and press **Delete** (or right-click → Delete). Deleting only a `…-match-cache` row clears that import cache and leaves your login intact.
- **In the Console:** `localStorage.removeItem('wellworth:books-match-cache')` (or `'wellworth:shows-match-cache'`). (Avoid `localStorage.clear()` — it also removes the auth token and logs you out.)

---

## Part S — Loading the Literature corpus (诗书)

The **Literature** module's poems/writers are an immutable **static asset**, not database rows. They
ship as generated JSON under `public/literature/**` (committed to the repo), so a normal clone + deploy
already has them — **you only do this when you want to add/refresh the corpus**. The two Supabase pieces
(your favourites + read-aloud settings) come from migrations `16_literature_schema.sql` /
`17_literature_profile_settings.sql`, applied like any other (Part F).

**To (re)generate the corpus from the source database:**

1. Get the source `poems.db` (the SQLite from the standalone `chinese-literature` app) and put it at
   **`scripts/literature/poems.db`** (this path is **gitignored** — the 19.5 MB DB is never committed;
   only the generated JSON is).
2. Install dependencies once (`npm install`) — this pulls in `better-sqlite3`, a build-time-only tool.
   On Windows it needs the native build chain; if `npm install` fails on it, install the
   **"Desktop development with C++"** workload (Visual Studio Build Tools,
   <https://visualstudio.microsoft.com/downloads/> → "Build Tools for Visual Studio") and re-run.
   > 💡 This step is **optional** — it's only for regenerating the corpus. If the C++ build is more
   > trouble than it's worth, **skip Part S entirely**: the corpus JSON under `public/literature/**` is
   > already committed, so the Literature module works in a normal clone/deploy without it.
3. Run **`npm run build:literature`**. It prints the poem/writer/type counts and writes
   `public/literature/{meta,index}.json` + `poem/<id>.json` + `writer/<id>.json`.
4. **Commit** the changed `public/literature/**` (that tree is the deployable source of truth — the
   deploy/CI build never needs `poems.db` or `better-sqlite3`).

The corpus is **not** affected by `supabase db reset` (it isn't in the database). Reading works fully
offline once the app is installed: browse/search/favourites are precached; a poem you open (or
favourite) is cached for offline reading.

> If you correct an existing poem's text (same id/URL), bump the runtime cache name
> (`literature-bodies-v1` in `vite.config.ts` **and** `BODY_CACHE` in `src/data/literature.ts`) so
> installed clients refetch it instead of serving the cached old copy.

---

## Part T — Changing the app logo / icons

The WellWorth logo appears in **two** forms — the same chop-seal "W" mark, rendered two ways:

1. **On-screen logo** (Login + Onboarding headers) — drawn live as an inline SVG tinted with the
   accent colour. This is what you see _inside_ the running app.
2. **Installed-app icons** (iPhone/iPad home screen, browser tab, PWA) — five raster files in
   `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`,
   `favicon.ico`). iOS and the browser can't use SVG, so these are **generated** PNGs/ICO.

Both forms read their shape from **one** file — `src/lib/brand-mark.js` (the seal's coordinates and
path). So you **edit the geometry in one place**; the on-screen mark updates automatically and the
icons update when you re-run the generator. They can't drift.

### To change the logo

1. **Edit the artwork** in **`src/lib/brand-mark.js`** — the rounded-square border, the `W` path,
   and the dot. Keep the `0 0 100 100` viewBox so both renderers stay aligned. (Colours aren't here:
   on screen the mark inherits the accent colour; the icons use the `ACCENT`/`BG` constants at the
   top of `scripts/gen-icons.mjs`.)
2. **Regenerate the icons:** `npm run gen:icons`. This overwrites all five files in `public/`.
   - You normally don't touch `gen-icons.mjs` itself — it already imports the shared geometry. The
     one thing it adds is a scaled group that gives the **maskable** icon its padding, so Android can
     crop it to a circle/squircle without clipping the mark; leave that in place.
3. **Check the result** — open `public/pwa-512x512.png` and `public/pwa-maskable-512.png` and confirm
   the mark looks right on the dark background and isn't clipped on the maskable one.
4. **Commit** the changed `src/lib/brand-mark.js` **and** the regenerated `public/*.png` /
   `favicon.ico` together, then push (auto-deploys).
5. **On your phone**, after the deploy, **remove and re-add** the home-screen icon — iOS caches the
   old icon and won't refresh it on its own.

> Don't hand-edit the PNGs in an image editor: the next `npm run gen:icons` would overwrite them.
> The geometry in `src/lib/brand-mark.js` (rasterized by `gen-icons.mjs`) is the source of truth.

---

## Quick reference

| Value                     | Where it comes from            | Where it goes                                      |
| ------------------------- | ------------------------------ | -------------------------------------------------- |
| Project URL               | Supabase → Settings → API      | `.env` `VITE_SUPABASE_URL` + Vercel env            |
| anon key                  | Supabase → Settings → API      | `.env` `VITE_SUPABASE_ANON_KEY` + Vercel env       |
| Project ref               | Supabase (the URL subdomain)   | `supabase link --project-ref`                      |
| DB password               | you set it at project creation | `SUPABASE_DB_PASSWORD` (for `db push`)             |
| USDA key                  | api.data.gov/signup            | `.env` `VITE_USDA_API_KEY` + Vercel env            |
| TMDB key                  | themoviedb.org → Settings→API  | `.env` `VITE_TMDB_API_KEY` + Vercel env            |
| Google Books key (opt.)   | Google Cloud → Books API       | `.env` `VITE_GOOGLE_BOOKS_API_KEY` + Vercel env    |
| Email allowlist (opt.)    | you choose (Part H3)           | `.env` `VITE_ALLOWED_EMAILS` + Vercel env          |
| Owner email (opt.)        | your own email (Part H3)       | `.env` `VITE_OWNER_EMAIL` + Vercel env             |
| Google Client ID + secret | Google Cloud → Clients         | Supabase → Auth → Providers → Google               |
| Supabase callback URL     | Supabase Google provider page  | Google Cloud → Authorized redirect URIs            |
| Vercel app URL            | after first deploy             | Google JS origins + Supabase Site/Redirect URLs    |
| Session-pooler URL        | Supabase → Settings → Database | backup secret `SUPABASE_DB_URL` (Part Q)           |
| age public / private key  | `age-keygen` (Part Q)          | secret `AGE_PUBLIC_KEY` / private key kept offline |
| Backups repo + PAT        | a private GitHub repo (Part Q) | secrets `BACKUPS_REPO` / `BACKUPS_REPO_TOKEN`      |

**Everyday commands** (from the project folder):

```
> npm run dev          # run locally at http://localhost:5173 (also on your LAN for phone testing)
> npm run check        # format + lint + type-check + tests (must pass before committing)
> npm run build        # production build
> supabase db push     # apply new database migrations
> supabase db reset --linked   # ⚠️ wipe + rebuild the DB from migrations (Part M1)
> npm run db:backup    # encrypted DB backup before anything risky (Part Q; or Actions → Run workflow)
> npm run gen:types    # regenerate src/types/database.ts after a schema change
> npm run gen:icons    # regenerate the app/PWA icons in public/ (after editing scripts/gen-icons.mjs)
> git add -A && git commit -m "what changed" && git push   # save + push changes (auto-deploys on Vercel)
```

**Chinese search fold-map (rarely needed).** Search matches Traditional and Simplified Chinese
interchangeably. The local-filter part uses a committed character map
(`src/constants/zh-fold-map.ts`) generated from the `opencc-js` dictionary. You only regenerate it
after upgrading `opencc-js`:

```
> node scripts/gen-zh-fold-map.mjs   # rewrites src/constants/zh-fold-map.ts, then commit the result
```

**Why two different mechanisms (a small map for in-app search, but a ~1MB library for the movie/book/
city searches).** The real dividing line isn't "local vs remote" — it's **"can we normalize both sides
of the comparison?"**

- **In-app search bars** (Shows/Books/Quotes/Medical/Travel filters, the food/city/test pickers) filter
  data that's **already loaded in the phone's memory**. So the app controls _both_ sides: it folds the
  text you typed **and** every stored title/name to one script (Simplified) and compares. Folding only
  ever goes Traditional→Simplified, which is almost always **many-to-one** (後/后, and HK 裏 / TW 裡 both
  → 里), so a plain per-character lookup is correct. That map is tiny (~60KB) and runs instantly on every
  keystroke — no big library needed. (Even if app search were ever changed to ask the database directly,
  this still wouldn't need `opencc-js`: it's _our_ database, so we'd store a folded column and query it
  with the folded term.)
- **The movie/TV (TMDB), book (Google Books), and city (Nominatim) searches** query **someone else's**
  catalogue over the internet. We can't fold _their_ data — we only control the text we send. So instead
  of folding both sides, the app sends the query in **both** scripts and merges the results. Generating
  the opposite script — Simplified→Traditional — is the hard direction: it's **one-to-many** (面 could be
  面 _or_ 麵; 里 could be 里/裡/裏) and needs phrase/context awareness to pick the right Hong-Kong
  character. That intelligence is exactly the ~1MB dictionary inside `opencc-js`, which is why it's only
  loaded — once, on demand — the first time you run one of those searches in Chinese, and never for the
  in-app filters. (The size gap is real: the Traditional→Simplified data is ~66KB; the
  Simplified→Traditional data is ~1MB.)

If something breaks, the most common causes: a value mistyped in `.env` or Vercel; the Vercel URL not
added to Google origins / Supabase redirect URLs (sign-in fails); or `SUPABASE_DB_PASSWORD` not set
(`db push` prompts/hangs).

**"Title search unavailable — is VITE_TMDB_API_KEY set?" (or Books search fails) on the deployed app
but not locally.** `VITE_` keys are **baked into the bundle at build time**, and Vercel builds with
**Vercel's** Environment Variables — it never sees your local `.env` (it's gitignored). If sign-in works
in production, your Supabase vars are set, but `VITE_TMDB_API_KEY` / `VITE_GOOGLE_BOOKS_API_KEY` /
`VITE_USDA_API_KEY` may be missing. Fix: **Vercel → Project → Settings → Environment Variables**, add
the missing keys (scope **Production**), then **redeploy** — env-var changes don't affect existing
builds (Deployments → ⋯ → **Redeploy**, and **uncheck "Use existing Build Cache"** so the bundle is
rebuilt with the new values). For **Google Books** specifically, also check the key's **Application
restrictions → Websites** in Google Cloud includes your production origin
(`https://<your-app>.vercel.app/*`); a key restricted to `localhost` only returns 403 in production.

**Still "not set" after you redeployed with the keys?** The app is an installable **PWA**, so the
**service worker serves the previously-cached bundle** (built without the keys) even after a new deploy —
logging out/in or a hard refresh won't replace it.

**Diagnose:** open the prod URL in an **incognito window** (no service worker / cache).

- **If it _still_ fails in incognito**, the Vercel build genuinely lacks the keys — recheck the exact var
  names (`VITE_TMDB_API_KEY` / `VITE_GOOGLE_BOOKS_API_KEY`, case-sensitive, **Production** scope) and
  redeploy without build cache (see the "empty value" note below).
- **If it works in incognito but not your normal browser**, it's the stale service-worker cache. Clear it
  (Chrome/Edge on Windows — nearly identical):
  1. Open the prod URL in the normal browser and press **F12** (or right-click → **Inspect**) to open
     DevTools.
  2. Click the **Application** tab (use the **»** overflow chevron if it's hidden).
  3. Left sidebar → **Storage** → click the **Clear site data** button. (This unregisters the service
     worker **and** clears all caches/storage in one go — a separate Service Workers → **Unregister** is
     then unnecessary.)
  4. **Close every tab** of the site, then reopen the URL — the browser now fetches the fresh bundle.
  - **No-DevTools alternative:** click the **padlock / site-info icon** left of the URL → **Site
    settings** (Chrome) / **Permissions for this site** (Edge) → **Delete data**, then close all tabs and
    reopen.
  - **If you installed the PWA** (desktop/taskbar/home screen): that installed window keeps its **own**
    service worker — clear site data from inside the installed window's DevTools, or uninstall and
    reinstall it.

> **Watch out for an _empty value_ hidden by "Sensitive".** A Vercel env var marked **Sensitive**
> shows its value as **blank in the UI even when set** — you can't read it back to confirm. If the build
> baked an empty string, you get the same "not set" error. To be sure: **delete and re-add** the var,
> pasting your **actual API key** as the value (no spaces/quotes/newline) — paste the _key_, not the
> variable name — then redeploy. **Definitive check:** in an incognito DevTools → **Network** → open the
> main `index-*.js` → **Response** → search for the first characters of your real key; if it isn't in
> the bundle, the value never made it into the build.
