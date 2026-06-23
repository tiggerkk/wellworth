# Shows CSV import — guide

Bulk-seed your back-catalogue into the **Shows** module: enable **Shows Settings → Enable CSV
import**, then **Import CSV**, choose your file, let it resolve each title against TMDB, fix any
flagged rows, and **Import**. Re-importing the **same** file **updates in place** (idempotent — no
duplicates), so partial re-runs are safe.

One CSV covers **English and Chinese** titles across **all three types** (TV / movie / documentary).

## Columns

```
title,type,status,rating,lgbtq_rep,dynasty,watched_seasons,watched_episodes,is_favorite
```

- **title** — the title to look up on TMDB. Required. (A CJK title is searched in Chinese.) For a
  documentary sub-series, fold the parent series into the title yourself (e.g.
  `国宝档案 — 从东晋到北魏`).
- **type** — `tv`, `movie`, or `documentary`. Required (it picks the TMDB endpoint — documentary uses
  `/tv`).
- **status** — `want`, `watching`, `watched`, or `dropped`. Required.
- **rating** — your stars, `0`–`5` in `0.5` steps. Optional (blank = unrated).
- **lgbtq_rep** — LGBT+ representation: `none`, `some`, or `significant`. Optional (blank = `none`).
- **dynasty** — Chinese dynasty, one of `近代 清代 明代 元代 宋代 五代 唐代 隋代 南北朝 魏晉 兩漢 先秦`.
  Optional, and **only kept for a Chinese title** (ignored otherwise). Blank = none. An unrecognised
  value skips the row.
- **watched_seasons / watched_episodes** — episodic progress (TV + documentary). **Leave blank for
  `watched` rows** (the importer sets them to the TMDB totals) and for movies / `want` rows. For
  `watching` and `dropped` rows, enter how far you got. You can put **`all`** in `watched_episodes`
  to mean "I finished every episode of the last season I was on" — fill in `watched_seasons` (the
  last-watched season number) and the importer looks that season's episode count up on TMDB and
  stores it. `all` is only valid on a `watching`/`dropped` TV or documentary row that has a
  `watched_seasons`; anywhere else the row is skipped. (If TMDB has no count for that season, the
  episode count is left blank.)
- **is_favorite** — `true`/`1`/`yes` marks the title a favourite (the ♥). Optional (blank = not a
  favourite).

Rows with an unknown `type`/`status`/`lgbtq_rep`/`dynasty`, a missing `title`, or a bad `rating` are
listed as skipped in the preview; everything else imports.

## How resolution works

For each row the importer searches TMDB for the title (scoped to `type`, Chinese-aware for CJK titles)
and takes the **top hit**, filling in poster, genres, director/creator, top cast, overview, runtime, and
(episodic) season/episode totals. Rows where the top hit's title differs from yours are **flagged for
review**, and rows TMDB can't find are flagged **No match** — open either and pick the right title (or
skip to keep it). A niche documentary with **no match** imports with **null TMDB metadata and no poster**;
top it up later by hand (paste a **Poster URL** on the Entry form) or via **Refresh from TMDB** once it's
been contributed to TMDB. **Dates are left empty** for every imported row (start/finish/last-update are
genuinely unknown), so imported history shows in the Library but not the Dashboard's "Recently Watched".

Re-importing is **idempotent**: a row updates the existing show with the same case-insensitive
**title** (type-agnostic), never a duplicate.

## Keep your real file private

The committed `templates/shows-import-template.csv` is a **sanitized example**. Keep your real,
filled list **gitignored** — e.g. name it `shows-import-mylist.csv` (`.gitignore` ignores
`shows-import*.csv`, keeping only the template). Never commit a private watch history.
