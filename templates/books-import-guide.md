# Books CSV import — guide

Bulk-seed your back-catalogue into the **Books** module: enable **Books Settings → Enable CSV
import**, then **Import CSV…**, choose your file, let it resolve each row against Google Books, fix any
flagged rows, and **Import**. Re-importing the **same** file **updates in place** (idempotent — no
duplicates), so partial re-runs are safe.

## Columns

```
title,author,rating,lgbtq_rep,end_date,is_favorite
```

- **title** — the book title to look up. Required.
- **author** — the author. Required (title + author are used **together** to disambiguate, since book
  titles collide far more than show titles).
- **rating** — your stars, `0`–`5` in `0.5` steps. Optional (blank = unrated).
- **lgbtq_rep** — LGBT+ representation: `none`, `some`, or `significant`. Optional (blank = `none`).
- **end_date** — the date you finished, as `YYYY-MM-DD` text. Optional (blank = unknown).
- **is_favorite** — `true`/`1`/`yes` marks the book a favourite (the ♥). Optional (blank = not a
  favourite).

Every imported row is recorded as **Read**. Rows with a missing `title`/`author`, a bad `rating`, an
unknown `lgbtq_rep`, or a malformed `end_date` are listed as skipped in the preview; everything else
imports.

## How resolution works

For each row the importer searches Google Books for `title author` and takes the **top hit** (falling
back to Open Library when Google has nothing), filling in cover, authors, year, description, genres,
page count, language, and ISBN. Rows where the top hit's title differs from yours are **flagged for
review**, and rows nothing can be found for are flagged **No match** — tap **Change** on either to pick
the right book (or import as-is to keep it with the CSV values and no metadata, then fix it later from
the Library). **`start_date` and `last_update_date` are left empty** for every imported row (genuinely
unknown); only `end_date` (the finish date) comes from your file.

## Keep your real file private

The committed `templates/books-import-template.csv` is a **sanitized example**. Keep your real, filled
list **gitignored** — e.g. name it `books-import-mylist.csv` (`.gitignore` ignores `books-import*.csv`,
keeping only the template). Never commit a private reading history.
