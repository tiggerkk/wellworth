# Books CSV import — guide

Bulk-seed your back-catalogue into the **Books** module: enable **Books Settings → Enable CSV
import**, then **Import CSV…**, choose your file, let it resolve each row against Google Books, fix any
flagged rows, and **Import**. Re-importing the **same** file **updates in place** (idempotent — no
duplicates), so partial re-runs are safe.

## Columns

```
title,author,status,rating,lgbtq_rep,dynasty,is_favorite,start_date,end_date
```

- **title** — the book title to look up. Required.
- **author** — the author. Required (title + author are used **together** to disambiguate, since book
  titles collide far more than show titles).
- **status** — `want`, `reading`, `read`, or `dropped`. Required.
- **rating** — your stars, `0`–`5` in `0.5` steps. Optional (blank = unrated).
- **lgbtq_rep** — LGBT+ representation: `none`, `some`, or `significant`. Optional (blank = `none`).
- **dynasty** — Chinese dynasty, one of `全部 近代 清代 明代 元代 宋代 五代 唐代 隋代 南北朝 魏晉 兩漢 先秦`.
  Optional, and **only kept for a Chinese title** (ignored otherwise). Blank = none. An unrecognised
  value skips the row.
- **is_favorite** — `true`/`1`/`yes` marks the book a favourite (the ♥). Optional (blank = not a
  favourite).
- **start_date** — `YYYY-MM-DD`. The date you started reading. **Required for every status except
  `want`** (which hasn't started — you may leave it blank). When set it also becomes the row's
  `created_at`; left blank on a `want` row, the record is just dated by its import time.
- **end_date** — `YYYY-MM-DD`. The finish / drop date. **Required for `read` and `dropped` rows**; left
  blank (and ignored) for `reading` / `want` rows.

The Library's **Date** sort uses `end_date` if present, else `start_date`. Rows with a missing
`title`/`author`, an unknown `status`/`lgbtq_rep`/`dynasty`, a bad `rating`, a missing `start_date` on a
non-`want` row, or a missing `end_date` on a read/dropped row are listed as skipped in the preview;
everything else imports.

## How resolution works

For each row the importer searches Google Books for `title author` and takes the **top hit** (falling
back to Open Library when Google has nothing), filling in cover, authors, year, description, genres,
page count, language, and ISBN. Rows where the top hit's title differs from yours are **flagged for
review**, and rows nothing can be found for are flagged **No match** — tap **Change** on either to pick
the right book (or import as-is to keep it with the CSV values and no metadata, then fix it later from
the Library). **Dates come from your file** — `start_date` on every row and `end_date` on read/dropped
rows — so imported books sort correctly and finished ones show in the Dashboard's "Recently Read".

## Keep your real file private

The committed `templates/books-import-template.csv` is a **sanitized example**. Keep your real, filled
list **gitignored** — e.g. name it `books-import-mylist.csv` (`.gitignore` ignores `books-import*.csv`,
keeping only the template). Never commit a private reading history.
