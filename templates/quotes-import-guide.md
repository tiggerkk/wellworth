# Quotes CSV import — guide

Bulk-seed your favourite quotes into the **Quotes** module: enable **Quotes Settings → Enable CSV
import**, then **Import CSV…**, choose your file, review the preview, and **Import**. Re-importing the
**same** file imports **nothing** the second time (idempotent — no exact duplicates), so partial
re-runs are safe.

## Columns

```
Quote,Author,Source,Title,Category,Tags,is_favorite,created_at
```

- **Quote** — the quote text. **Required.** May contain commas, double-quotes, and even line breaks —
  keep the whole cell wrapped in `"…"` (Excel/Numbers do this automatically on **Save As CSV UTF-8**),
  and double any internal quote as `""`.
- **Author** — who said or wrote it (the speaker/character for screen quotes). Optional.
- **Source** — the medium. **Required**, and must match one of your configured **Source Types**
  (Quotes Settings → Values → Source Types) by its **key or label**, case-insensitive — so both `tv`
  and `TV Show` work. Default values: Book, Podcast, TV Show, Movie, Interview, Article, Song, Video. An
  unknown or blank value flags the row.
- **Title** — the source title (show, film, book, podcast…). Optional. If it matches one of your
  existing **Shows** (for the Show-linking sources TV/Movie) or **Books** (for Book) by title, the quote
  is **linked** to that record automatically.
- **Category** — **Required**, and must match one of your configured **Categories** (Quotes Settings →
  Values → Categories) by key or label, case-insensitive. Default values: Wit, Observation, Philosophy,
  Heart, Connection, Growth. A blank or unrecognised value flags the row.
- **Tags** — a single cell of comma-separated tags, e.g. `"wisdom, humility"`. Optional (blank = none).
  Wrap it in quotes so the commas stay inside one cell; each tag is then trimmed and de-duplicated.
- **is_favorite** — `true`/`1`/`yes` marks the quote a favourite (the ♥). Optional (blank = not a
  favourite).
- **created_at** — `YYYY-MM-DD`. **Required** — the date to record the quote under; it drives the
  Library/Zen **Date** sort (so older entries can sort after newer ones however you like).

The **language** (English / Chinese) is detected automatically from the text — any CJK character marks
the quote as Chinese.

## What gets imported

The preview splits your file into **new** (imported), **duplicate** (skipped — same text as a quote you
already have, or repeated within the file), and **flagged** (a missing Quote, a bad Category, an unknown
Source, or a missing/malformed `created_at` — listed with line numbers and **not** imported). Only the
new, valid rows are written.

## Keep your real file private

The committed `templates/quotes-import-template.csv` is a **sanitized example**. Keep your real, filled
list **gitignored** — e.g. name it `quotes-import-mylist.csv` (`.gitignore` ignores `quotes-import*.csv`
and `quotes-seed-local.csv`, keeping only the template). Never commit a private quote collection.
