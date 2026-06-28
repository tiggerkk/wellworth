# Fund import (JPM "My Portfolio" → CSV)

Monthly fund holdings are imported from the JPM **My Portfolio** export saved as CSV. The import
**overwrites the selected month's `fund` rows only** (manual + insurance entries are untouched).
Open it from **Monthly Entry → Fund section header → import icon**.

## Columns (header row, exactly as JPM exports)

```
Fund Name, Account, Asset Class, Total Holdings, Base Currency, Avg. Unit Cost,
NAV Per Unit (As of Date), Total Cost, Total Value, Return Rate%, Profit/Loss
```

## Parsing notes

- Amounts carry an `HKD `/`USD ` prefix and thousands commas — both are stripped.
- **Total Value is already in HKD** → it becomes the holding's net-worth value (no FX needed).
- Per-unit figures (`Avg. Unit Cost`, `NAV Per Unit`) are in the fund's **Base Currency**, kept in
  `details` for the Fund detail modal.
- The **NAV cell** embeds the priced-as-of date in parentheses — `HKD 16.43(2026/06/25)` (there may
  be a space and/or a line break before the `(`). It is split into the numeric NAV + the as-of date.
- The export ends with a blank row then a `Downloaded on:` / disclaimer footer — both are ignored.

## Example (sanitized)

```
Fund Name,Account,Asset Class,Total Holdings,Base Currency,Avg. Unit Cost,NAV Per Unit (As of Date),Total Cost,Total Value,Return Rate%,Profit/Loss
Example Equity Fund,Master Account,Equity,1000.000,HKD,HKD 10.00,HKD 11.00(2026/06/25),"HKD 10,000.00","HKD 11,000.00",+10.00%,"HKD +1,000.00"
Example USD Bond Fund,Master Account,Bond,100.000,USD,USD 50.00,USD 52.00(2026/06/25),"HKD 39,000.00","HKD 40,560.00",+4.00%,"HKD +1,560.00"
```

> Real exports contain private balances — keep them out of git (gitignored as `*Fund*export*.xlsx`).
