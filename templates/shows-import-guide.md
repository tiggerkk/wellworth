# Shows CSV import — guide

Bulk-seed your back-catalogue into the **Shows** module: enable **Shows Settings → Enable CSV
import**, then **Import CSV**, choose your file, let it resolve each title against TMDB, fix any
flagged rows, and **Import**. Re-importing the **same** file **updates in place** (idempotent — no
duplicates), so partial re-runs are safe.

## Columns

```
title,type,status,rating,lgbtq_rep,watched_seasons,watched_episodes
```

- **title** — the title to look up on TMDB. Required.
- **type** — `tv` or `movie`. Required (it picks the TMDB search endpoint).
- **status** — `want`, `watching`, `watched`, or `dropped`. Required.
- **rating** — your stars, `0`–`5` in `0.5` steps. Optional (blank = unrated).
- **lgbtq_rep** — LGBT+ representation: `none`, `some`, or `significant`. Optional (blank = `none`).
- **watched_seasons / watched_episodes** — TV progress. **Leave blank for `watched` rows** (the
  importer sets them to the TMDB totals) and for movies / `want` rows. For `watching` and `dropped`
  TV rows, enter how far you got.

Rows with an unknown `type`/`status`/`lgbtq_rep`, a missing `title`, or a bad `rating` are listed as
skipped in the preview; everything else imports.

## How resolution works

For each row the importer searches TMDB for the title (scoped to `type`) and takes the **top hit**,
filling in poster, genres, director/creator, top cast, overview, runtime, and (TV) season/episode
totals. Rows where the top hit's title differs from yours are **flagged for review**, and rows TMDB
can't find are flagged **No match** — open either and pick the right title (or skip to keep it with
no metadata). **Dates are left empty** for every imported row (start/finish/last-update are genuinely
unknown), so imported history shows in the Library but not the Dashboard's "Recently Watched".

## Keep your real file private

The committed `templates/shows-import-template.csv` is a **sanitized example**. Keep your real,
filled list **gitignored** — e.g. name it `shows-import-mylist.csv` (`.gitignore` ignores
`shows-import*.csv`, keeping only the template). Never commit a private watch history.
