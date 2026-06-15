# Net Worth CSV import — guide

Bulk-load (or replace) a month's holdings in the Net Worth module: **Monthly Entry → Import CSV**,
pick the month, choose your CSV, review the preview, then **Import**. Re-importing a month **replaces**
its entries (idempotent — no duplicates).

## Columns

```
asset_type,name,currency,value_native,detail1_key,detail1_value,detail2_key,detail2_value
```

- **asset_type** — one of `cash, time_deposit, stock, mutual_fund, retirement, insurance, property`.
- **name** — your label (institution, ticker/company, fund, policy, address…).
- **currency** — `HKD`, `CNY`, or `USD`.
- **value_native** — the value in that currency. Quoted thousands separators are fine
  (`"8,466,568.80"`); the importer strips commas/quotes before parsing.
- **detailN_key / detailN_value** — optional, type-specific, stored as-is (informational). Any number
  of pairs is accepted. Suggested keys: time_deposit → `maturity_date`; stock → `ticker`, `shares`;
  mutual_fund → `units`, `cost`; insurance → `premium`, `policy_year`.

Rows with an unknown `asset_type`/`currency`, a missing `name`, or a non-numeric `value_native` are
listed as skipped in the preview; everything else imports.

## How values convert

Each row's `value_native` converts to HKD using the **1st-of-month** ECB rate (Frankfurter,
auto-fetched in the importer); HKD is 1. The rate and the converted HKD value are **frozen** on each
entry, so the month is immune to later FX revisions.

## Keep your real file private

The committed `templates/networth-seed-template.csv` is a **sanitized example**. Keep your real,
filled file **gitignored** — e.g. `templates/networth-seed.local.csv` (`.gitignore` ignores
`*.local.csv`, `*-filled.csv`, and `networth-*.csv`). Never commit real balances.
