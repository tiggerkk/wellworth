# Insurance import

Two importers feed the insurance policy catalogue. Real exports contain private financial data —
keep them out of git (`Insurance.csv` / `Insurance.xlsx` are gitignored).

## 1. Bulk seed (one-time) — wide spreadsheet → CSV

Open from **Net Worth → Settings → Import → Import CSV Insurance** (gated by the _Enable Bulk
Insurance Import_ toggle). Save the wide spreadsheet (`Insurance.xlsx`) as CSV.

Layout — one **4-column block per policy**, with a shared `Age` in column A:

- **Row 1 — Provider**: the provider name appears in each provider's first column; the importer
  **carries it forward** across blank cells (e.g. CHUBB → BOC → Manulife). Each name is matched (by
  key or label, case-insensitive) against your **configured provider list** (Net Worth → Settings →
  Manage Providers). A name that matches none **skips its block** with an error — add the provider in
  Settings first, then re-import.
- **Row 2 — Policy Name**: in each block's first column.
- **Row 3 — `Policy Number: Start Date`**: e.g. `2150202771: Oct 7, 2015`. The number is the
  policy's identity / update key; a block **without a number is skipped**.
- **Row 4 — Notes** (optional, per policy): free text in each block's first column → the policy's
  **Notes** field. Leave blank for none.
- **Row 5 — Sub-header** (repeats per block): `Policy Year, Total Premium Paid, Cash Value,
Surrender Gain %/Yr`.
- **Data rows**: `Age` (col A) + the 4 values per block. Only ages with a real Premium **and** Cash
  Value become schedule points.
- **Trailing total columns are ignored** (their sub-header is `USD`/`HKD`, not `Policy Year`).

At import you **confirm each provider's currency** (HKD / CNY / USD; pre-filled from each provider's
configured **default currency** — Manage Providers — e.g. CHUBB = USD, BOC = USD, Manulife = HKD). Each
imported policy gets an **Original** schedule from its points.

**Maturity is auto-detected:** a policy whose schedule **ends before your current insurance age**
(i.e. no row at your current age) is marked **Matured** — proceeds = the last row's Cash Value;
maturity date = the start date's month+day with year = start year + the last row's policy year. (No
birthday set in your profile ⇒ no auto-maturity.) After this one-time seed, mark later maturities /
surrenders on the **Edit Insurance** screen so you can set the exact date.

## 2. Single policy add / update — narrow CSV

Open from **New / Edit Insurance → Import Policy Schedule**. A tiny header, then the data table.
Currency and effective date are **set on the screen**, not in the file. **Two header layouts are
accepted** (auto-detected):

**Key/value** — a label in column A, its value in column B:

```
Provider,CHUBB
Policy Number,2150202771
Policy Name,Example Whole Life
Start Date,"Oct 7, 2015"
Notes,Paid up
Age,Policy Year,Total Premium Paid,Cash Value,Surrender Gain %/Yr
45,4,"60,000","37,276",-9.5
46,5,"75,000","52,248",-6.1
```

**Stacked block** — what the wide spreadsheet (§1) exports for a single policy: column A blank, with
provider / policy name / `Policy Number: Start Date` / notes stacked in column B (the notes row may be
omitted). The data table is identical.

```
,CHUBB,,,
,Example Whole Life,,,
,"2150202771: Oct 7, 2015",,,
,,,,
Age,Policy Year,Total Premium Paid,Cash Value,Surrender Gain %/Yr
45,4,"60,000","37,276",-9.5
46,5,"75,000","52,248",-6.1
```

- **Provider** + **Policy Number** are required and **must match** the policy on screen.
- **Policy Name** + **Start Date** + **Notes** are optional and, if present, override the policy.
- **Surrender Gain %/Yr** is ignored (recomputed by the app). Rows without a Premium + Cash Value
  are skipped.
- **Maturity is auto-detected** the same way as the bulk seed (schedule ends before your current
  age ⇒ Matured, with the date derived from the start date + last policy year).
- On import, choose **Add new version** (anniversary update) or **Replace an existing version**. A
  brand-new policy's first import creates the **Original** baseline. Fix a mistyped effective date by
  editing it on the screen — no re-import needed.
