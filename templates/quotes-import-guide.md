# Quotes CSV import — guide

Bulk-seed your favourite quotes into the **Quotes** module: enable **Quotes Settings → Enable CSV
import**, then **Import CSV…**, choose your file, review the preview, and **Import**. Re-importing the
**same** file imports **nothing** the second time (idempotent — no exact duplicates), so partial
re-runs are safe.

## Columns

```
Quote,Author,Source,Title,Category,Tags,is_favorite
```

- **Quote** — the quote text. **Required.** May contain commas, double-quotes, and even line breaks —
  keep the whole cell wrapped in `"…"` (Excel/Numbers do this automatically on **Save As CSV UTF-8**),
  and double any internal quote as `""`.
- **Author** — who said or wrote it (the speaker/character for screen quotes). Optional.
- **Source** — the medium. **Required**, one of: `tv`, `movie`, `book`, `podcast`, `article`, `video`,
  `song` (case-insensitive). An unknown or blank value flags the row.
- **Title** — the source title (show, film, book, podcast…). Optional. If it matches one of your
  existing **Shows** (for `tv`/`movie`) or **Books** (for `book`) by title, the quote is **linked** to
  that record automatically.
- **Category** — **Required**, exactly one of: `philosophy`, `heart`, `connection`, `growth`, `wit`,
  `observation` (case-insensitive). A blank or unrecognised value flags the row.
- **Tags** — a single cell of comma-separated tags, e.g. `"wisdom, humility"`. Optional (blank = none).
  Wrap it in quotes so the commas stay inside one cell; each tag is then trimmed and de-duplicated.
- **is_favorite** — `true`/`1`/`yes` marks the quote a favourite (the ♥). Optional (blank = not a
  favourite).

The **language** (English / Chinese) is detected automatically from the text — any CJK character marks
the quote as Chinese.

## What gets imported

The preview splits your file into **new** (imported), **duplicate** (skipped — same text as a quote you
already have, or repeated within the file), and **flagged** (a missing Quote, a bad Category, or an
unknown Source — listed with line numbers and **not** imported). Only the new, valid rows are written.

## Keep your real file private

The committed `templates/quotes-import-template.csv` is a **sanitized example**. Keep your real, filled
list **gitignored** — e.g. name it `quotes-import-mylist.csv` (`.gitignore` ignores `quotes-import*.csv`
and `quotes-seed-local.csv`, keeping only the template). Never commit a private quote collection.
