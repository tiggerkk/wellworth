# Insurance import

Two importers feed the insurance policy catalogue. Real exports contain private financial data —
keep them out of git (`Insurance.csv` / `Insurance.xlsx` are gitignored).

## 1. Bulk seed (one-time) — wide spreadsheet → CSV

Open from **Net Worth → Settings → Import → Import CSV Insurance** (gated by the _Enable Bulk
Insurance Import_ toggle). Save the wide spreadsheet (`Insurance.xlsx`) as CSV.

Layout — one **4-column block per policy**, with a shared `Age` in column A:

- **Row 1 — Provider**: the provider name appears in each provider's first column; the importer
  **carries it forward** across blank cells (CHUBB → BOC → Manulife).
- **Row 2 — Policy Name**: in each block's first column.
- **Row 3 — `Policy Number: Start Date`**: e.g. `2150202771: Oct 7, 2015`. The number is the
  policy's identity / update key; a block **without a number is skipped**.
- **Row 4 — Sub-header** (repeats per block): `Policy Year, Total Premium Paid, Cash Value,
Surrender Gain %/Yr`.
- **Data rows**: `Age` (col A) + the 4 values per block. Only ages with a real Premium **and** Cash
  Value become schedule points.
- **Trailing total columns are ignored** (their sub-header is `USD`/`HKD`, not `Policy Year`).

At import you **confirm each provider's currency** (defaults: CHUBB = USD, BOC = USD,
Manulife = HKD). Each imported policy gets an **Original** schedule from its points.

## 2. Single policy add / update — narrow CSV

Open from **New / Edit Insurance → Import Policy Schedule**. A tiny key/value header, then the data
table. Currency and effective date are **set on the screen**, not in the file.

```
Provider,CHUBB
Policy Number,2150202771
Policy Name,Example Whole Life
Start Date,"Oct 7, 2015"
Age,Policy Year,Total Premium Paid,Cash Value,Surrender Gain %/Yr
45,4,"60,000","37,276",-9.5
46,5,"75,000","52,248",-6.1
```

- **Provider** + **Policy Number** are required and **must match** the policy on screen.
- **Policy Name** + **Start Date** are optional and, if present, override the policy.
- **Surrender Gain %/Yr** is ignored (recomputed by the app). Rows without a Premium + Cash Value
  are skipped.
- On import, choose **Add new version** (anniversary update) or **Replace an existing version**. A
  brand-new policy's first import creates the **Original** baseline. Fix a mistyped effective date by
  editing it on the screen — no re-import needed.
