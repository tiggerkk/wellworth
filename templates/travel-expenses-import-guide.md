# Travel — Import CSV Expenses

Bulk-load a trip's spend from a **wide** CSV (one row per day, a column per category) via WellWorth →
**Travel → Settings → Import CSV Expenses**. See `travel-expenses-template.csv` for the exact shape.

## Columns

```
Trip, Date, Restaurant, Take-out, Groceries, Shopping, Activity, Hotel, Local Transit, Flight/Train, Cost, Re-imbursed
```

- **Trip** — the trip name. Rows attribute to a trip by name (matched case-insensitively); a trip that
  doesn't exist yet is **created** (status _Visited_, base currency _CNY_ — adjust afterwards in Edit Trip.
- **Date** — `YYYY-MM-DD` (also accepts `YYYY/M/D`). Optional.
- **Category columns** (Restaurant … Flight/Train) — put the amount in the column(s) for that day. A row
  with **more than one** category filled **splits into several expenses**. The headers match your
  configured category **labels**; if you've renamed categories, your custom labels are matched instead,
  and any header the app doesn't recognize is surfaced on the review screen to **map to a category or
  skip** (never silently dropped).
- **Cost** — the row total. It's **cross-checked** against the sum of the category cells; a mismatch is a
  warning, not an error. If a row fills only **Cost** (no category), it's assigned to your first category.
- **Re-imbursed** — the row's reimbursed amount; on a split row it's **allocated pro-rata** by cost.

Amounts may include currency symbols and thousands commas (e.g. `¥2,067`, `HK$ 88`) — they're stripped.
All amounts are taken in the **trip's base currency** (the sheet has no currency column); set the HKD
conversion rates afterwards in the trip's **Expenses** tab.

## Steps

1. Fill in the template (one row per day; leave unused category columns blank).
2. Save as a `.csv` (UTF-8).
3. Travel → Settings → **Import CSV Expenses** → choose the file → review the detected columns, map any
   unknown headers, optionally tick **Replace existing expenses for matched trips** → **Import**.

> Real expense files are git-ignored (`travel-expenses*.csv`); only this sanitized template is tracked.
