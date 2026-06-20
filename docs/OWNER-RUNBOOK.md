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

1. **Node.js** (the JavaScript runtime). Download the **LTS** installer from <https://nodejs.org> and
   run it with default options.
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
2. Fill in: **Name** = `wellworth`; **Database Password** = generate a strong one and **save it in a
   password manager** — you'll need it to run migrations; **Region** = the one closest to you; Plan =
   Free. Click **Create new project** and wait ~2 minutes for it to provision.
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
   ```
   - `VITE_SUPABASE_URL` — the Project URL from Part B.
   - `VITE_SUPABASE_ANON_KEY` — the anon public key from Part B.
   - `VITE_USDA_API_KEY` — the USDA key from Part C.
   - `VITE_TMDB_API_KEY` — the TMDB v3 key from Part C2.
   - `VITE_GOOGLE_BOOKS_API_KEY` — Google Books key from Part C3 (recommended; blank works but
     rate-limits quickly). Save and close.

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
   This applies the migration files: `…_init_schema.sql` (schema + RLS + API-role grants),
   `…_seed_nutrient.sql` (the nutrient reference rows), `…_networth_schema.sql` (the Net Worth
   tables), `…_shows_schema.sql` (the Shows `show` table), and `…_profile_show_settings.sql` (the two
   Shows preference columns on `profile`).

- ✅ Check (in the Supabase dashboard):
  - **Table Editor** shows ten tables: `nutrient`, `profile`, `food`, `serving`, `activity`,
    `diary_entry`, `strength_set`, the Net Worth pair `networth_snapshot`, `asset_entry`, and the
    Shows table `show`.
  - **SQL Editor** → run `select count(*) from nutrient;` → returns **80**.
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
   > Import CSV** (pick the month; re-importing replaces that month — see
   > `templates/networth-import-guide.md`). (History note: real balances were once committed and later
   > purged from git history with a force-push — if you have an old clone, re-clone it so it doesn't
   > push the old history back.)

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
   - `VITE_GOOGLE_BOOKS_API_KEY` = your Google Books key (optional — omit if you skipped Part C3)
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
> `.env` values, also update them in Vercel → Project → Settings → Environment Variables, then
> redeploy.

---

## Part L — Install on iPhone / iPad

1. On the device, open the Vercel URL **in Safari** (must be Safari, not Chrome).
2. Sign in with Google once to confirm it works.
3. Tap the **Share** icon (the square with an up-arrow) → **Add to Home Screen** → **Add**.
4. Launch **WellWorth** from the home screen — it opens full-screen like a normal app, with the coral
   icon.

- ✅ Check: signed in, you can log a food and an activity, and the **barcode** button in Add Food
  opens the camera and scans a product (allow camera access when prompted).

---

## Part M — Resetting & re-seeding data

Three maintenance jobs: **M1** wipes + rebuilds everything, **M2** refreshes the starter activities,
and **M3** resets one module's data while leaving the others intact.

Only **Wellness** has seed data: the owner's **profile** + **activity library** are re-seeded on the
next sign-in (idempotent — only when that data is missing), and the **nutrient** reference table is
seeded by a migration (not on login). **Net Worth, Shows, and Books have no seed data** — their tables
(`networth_snapshot`/`asset_entry`, `show`, `book`) come back **empty** after a reset and are filled
entirely by you in the app.

> ⚠️ These act on your **live** Supabase project. There is no undo. Make sure you mean it.

### M1 — Completely reset the database (wipe + rebuild from migrations)

Use this to get a pristine database matching the migration files (e.g. after consolidating
migrations, or to clear all test data). It **drops everything and replays the migrations**, so all
foods, activities, and diary entries are erased.

From the project folder (the database password must be available — see Part F):

```
> supabase db reset --linked
```

Confirm at the prompt. The CLI re-runs **every** file in `supabase/migrations/` — currently
`…_init_schema.sql`, `…_seed_nutrient.sql`, `…_networth_schema.sql`, `…_shows_schema.sql`,
`…_profile_show_settings.sql`, `…_books_schema.sql`, and `…_profile_book_settings.sql` — against the
remote, leaving a clean schema + the 80 nutrient rows and a migration-ledger that matches the files.
(You never list them yourself; the CLI applies whatever is in the folder, so new migrations are picked
up automatically.)

- ✅ Check:
  1. `> supabase migration list` shows the same migrations locally and remotely.
  2. Reload the app and sign in → you land on the Diary; your **profile** and the **activity library**
     have been re-seeded; SQL `select count(*) from nutrient;` returns **80**.

> If sign-in itself was wiped, just sign in again with Google — a fresh profile + activities are
> created on first login.

### M2 — Re-seed activities after changing `seed-activities.ts`

The starter activities live in `src/constants/seed-activities.ts` and are seeded **once**, only when
you have **zero** activities (`ensureOwnerActivities` is a no-op otherwise). So after you edit that
file (new activities, changed METs/durations), you must clear the existing rows, then sign in again —
no full reset needed, and your foods and diary history are kept. (Activities are the **only**
client-seeded library; Net Worth, Shows, and Books have no starter data, so there's nothing to
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
without touching the others (e.g. reset Wellness and go live on it while Net Worth, Shows, and Books
stay as they are). Run the SQL in **Supabase → SQL Editor** (Dashboard → **SQL Editor** → **New query**
→ paste → **Run**). It edits **data only** — never the schema or the migrations.

> ⚠️ The SQL Editor runs with full privileges (it bypasses row-level security), so `truncate` wipes
> **all** rows in those tables — on a solo project that's exactly your data. `cascade` also clears the
> dependent child rows (strength sets, servings, asset entries). There is no undo.

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

**Net Worth** — wipes every monthly snapshot and its asset entries:

```sql
truncate public.networth_snapshot, public.asset_entry cascade;
```

**Shows** — wipes every tracked title:

```sql
truncate public.show cascade;
-- optional: also reset the Shows settings on your profile to defaults
update public.profile set show_visible_fields = null, show_importer_enabled = false;
```

**Books** — wipes every tracked book:

```sql
truncate public.book cascade;
-- optional: also reset the Books settings on your profile to defaults
update public.profile set book_visible_fields = null, book_importer_enabled = false;
```

- ✅ Check: open that module in the app — its lists are empty (Wellness shows the re-seeded starter
  activities after a reload), and the **other** modules' data is untouched.

> **Multi-user note (future household project):** `truncate` clears every user's rows. To scope a wipe
> to **yourself**, instead run `delete from <table> where user_id = '<your-user-id>';` on each module's
> **own** tables — `activity`, `food`, `diary_entry` (Wellness) / `networth_snapshot` (Net Worth) /
> `show` / `book` — and the child rows (`serving`, `strength_set`, `asset_entry`) cascade automatically.
> Your user id is in **Supabase → Authentication → Users**.

---

## Quick reference

| Value                     | Where it comes from            | Where it goes                                   |
| ------------------------- | ------------------------------ | ----------------------------------------------- |
| Project URL               | Supabase → Settings → API      | `.env` `VITE_SUPABASE_URL` + Vercel env         |
| anon key                  | Supabase → Settings → API      | `.env` `VITE_SUPABASE_ANON_KEY` + Vercel env    |
| Project ref               | Supabase (the URL subdomain)   | `supabase link --project-ref`                   |
| DB password               | you set it at project creation | `SUPABASE_DB_PASSWORD` (for `db push`)          |
| USDA key                  | api.data.gov/signup            | `.env` `VITE_USDA_API_KEY` + Vercel env         |
| TMDB key                  | themoviedb.org → Settings→API  | `.env` `VITE_TMDB_API_KEY` + Vercel env         |
| Google Books key (opt.)   | Google Cloud → Books API       | `.env` `VITE_GOOGLE_BOOKS_API_KEY` + Vercel env |
| Google Client ID + secret | Google Cloud → Clients         | Supabase → Auth → Providers → Google            |
| Supabase callback URL     | Supabase Google provider page  | Google Cloud → Authorized redirect URIs         |
| Vercel app URL            | after first deploy             | Google JS origins + Supabase Site/Redirect URLs |

**Everyday commands** (from the project folder):

```
> npm run dev          # run locally at http://localhost:5173 (also on your LAN for phone testing)
> npm run check        # format + lint + type-check + tests (must pass before committing)
> npm run build        # production build
> supabase db push     # apply new database migrations
> supabase db reset --linked   # ⚠️ wipe + rebuild the DB from migrations (Part M1)
> npm run gen:types    # regenerate src/types/database.ts after a schema change
> git add -A && git commit -m "what changed" && git push   # save + push changes (auto-deploys on Vercel)
```

If something breaks, the most common causes: a value mistyped in `.env` or Vercel; the Vercel URL not
added to Google origins / Supabase redirect URLs (sign-in fails); or `SUPABASE_DB_PASSWORD` not set
(`db push` prompts/hangs).
