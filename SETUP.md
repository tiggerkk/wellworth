# SETUP — Building WellWorth with Claude Code (inside Trae.ai)

This guide assumes you've never used Claude Code. Claude Code is a command-line tool; you'll run it in
**Trae.ai's built-in terminal**. Trae has its own AI, but here we use Claude Code specifically.

---

## A. One-time prerequisites

1. **Node.js (LTS, v18+)** — install from nodejs.org. Verify in a terminal: `node -v`.
2. **A Claude plan with Claude Code access.** ⚠️ This is the one piece that isn't free: Claude Code runs on your Claude subscription (included with Pro and Max plans, subject to usage limits) or on API billing. The _app's_ runtime stack is free; the _build tool_ is not. See https://docs.claude.com/en/docs/claude-code/overview for current details.
3. **A free Supabase account** (supabase.com) and a **new project** (note its project URL + anon key from Project Settings → API). Keep the **service-role key** private — you won't put it in the app.
4. **A free USDA key** from https://api.data.gov/signup (for food search).
5. **Google login (can be done later):** in Google Cloud, create an OAuth client, then paste its ID + secret into Supabase → Authentication → Providers → Google. Claude Code can walk you through this when you reach the auth milestone.
6. _(Optional, for publishing)_ a **GitHub** account + **Vercel** free account.

---

## B. Set up the project folder

1. Make a folder, e.g. `wellworth/`.
2. Unzip this bundle into it so the structure is:
   ```
   wellworth/
     CLAUDE.md
     docs/00-PRD.md ... 05-seed-data.md
     docs/wireframes/   (optional: drop screen screenshots here)
   ```
   `CLAUDE.md` **must sit at the folder root** — Claude Code loads it automatically every session.
3. In Trae.ai, **open this folder** as your project.

---

## C. Install and start Claude Code

1. Open Trae's integrated terminal (View → Terminal), making sure you're inside the `wellworth/` folder.
2. Install Claude Code:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
3. Start it:
   ```
   claude
   ```
   The first run will ask you to log in (it opens a browser). Sign in with your Claude account.

---

## D. (Recommended) Connect the Supabase MCP

This lets Claude Code design your schema and generate types directly. You can also skip this now and do it when you reach the database milestone.

- In the Claude Code session, run `/mcp` (or `claude mcp add`) and add the **Supabase** server, then
  authorize it for your Supabase project. You'll provide a Supabase access token / project ref when
  prompted. For the latest exact steps see the Supabase MCP setup page (search "Supabase MCP Claude
  Code").
- Remember the rule from CLAUDE.md: the MCP **designs and inspects**, but schema changes are written as **migration files** that _you_ apply with the Supabase CLI — so you keep a clean, versioned schema.

---

## E. The first prompt (this is the important one)

In the Claude Code session, **switch to Plan mode first**: press **Shift+Tab** to cycle input modes
until it shows _plan mode_ (in plan mode it proposes a plan and won't edit files until you approve).

Then paste this prompt exactly:

> Read CLAUDE.md and every file in /docs before doing anything. These are the source of truth for this
> project — WellWorth, a wellness-tracking PWA.
>
> Do not write any code yet. Instead:
>
> 1. Confirm you've read the docs and briefly restate the chosen stack and the Phase-1 (Wellness) scope,
>    so I know we're aligned.
> 2. List any genuine ambiguities or decisions you need from me. Do not invent product decisions — ask.
> 3. Propose a milestone-based build plan for **Phase 1 (Wellness) only** — not Net Worth — ordered so
>    each milestone is independently runnable. Suggested sequence: project scaffold + tooling (Prettier,
>    ESLint, tsc, Vitest, Tailwind, vite-plugin-pwa) → Supabase schema migrations + RLS + seed data →
>    Google auth + profile + first-run → typed data-access layer + generated DB types → Diary &
>    food/activity logging → Dashboard / Daily Report → Library (custom food & activity) → Settings →
>    PWA install + deploy.
> 4. Then detail **Milestone 1 only** as concrete steps and wait for my approval before building.
>
> Follow every rule in CLAUDE.md — especially: no SQL in the front end (all DB access via a typed
> data-access layer wrapping supabase-js), RLS on every table, store everything metric, shared
> components only, and ship schema changes as migration files I apply via the Supabase CLI.

Review the plan it proposes. When you're happy, tell it to proceed with Milestone 1. Work
**one milestone at a time** — approve, let it build, run it, then move on.

---

## F. The build loop (per milestone)

1. Claude Code writes code and drafts any migrations into `supabase/migrations/`.
2. **You apply migrations** yourself: `supabase db push` (install the Supabase CLI once). Review the SQL
   first. Then have Claude Code regenerate `src/types/database.ts`.
3. Create a `.env` file (Claude Code will tell you which keys) with your Supabase URL, **anon** key, and
   USDA key. Never add the service-role key.
4. Run the app locally: `npm run dev`. Open the printed URL on your computer to test.
5. To test on your iPhone/iPad: deploy to Vercel (or run on your network over HTTPS), open the URL in
   Safari, then **Share → Add to Home Screen**. (Barcode scanning needs HTTPS, which Vercel provides.)

---

## G. Tips

- Keep `CLAUDE.md` at the root and update it as conventions evolve — it's your steering file.
- If Claude Code starts guessing about product behavior, point it back to the relevant `/docs` file.
- Add screen screenshots to `docs/wireframes/` and reference them in a prompt if you want it to match a
  layout precisely.
- Always review migrations and any destructive action before approving.
