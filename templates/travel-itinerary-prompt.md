# Trip Itinerary → JSON Extraction Prompt (model-agnostic, ALL trips at once)

Prefix each trip's text with a delimiter line, paste them all, then the prompt below. Save the output as `trips.json` and import via WellWorth → Settings → **Import JSON Trips**. The import is a **draft** you finish in the Trip Builder.

## Step 1 — add a delimiter line before each trip

```
=== TRIP: 湖北 | 2026-03 | visited | "Ady" | 4.5 ===

28（荆州）：travel,"香港-深圳北-荆州","（11:41-11:59）-（12:47-19:49, ¥2067）"
1（荆州）：visit,"楚王车马阵¥58" | visit,"荆州博物馆" | visit,"开元观" | visit,"关羽祠¥25" | visit,"关帝庙¥18" | other,"幸福蓝海国际影城¥42" | visit,"荆街"]

=== TRIP: 肇庆 | 2026-01 | visited | "Ady" | 3.5 ===
30（肇庆）: travel,"香港-肇庆东","（10:02-11:48）" | eat,"黔牛爷牛肉私房菜馆" | visit,"七星岩（免费咖啡）" | shop,"敏捷广场（永旺）"
```

## Step 2 — paste this prompt, then all your delimited trips

```
You convert MANY freeform travel itineraries into one JSON array. The input is divided into trips, each starting with a line: === TRIP: <trip_name> | <YYYY-MM> | <status> | <companions> | <rating> ===. Output ONLY one JSON array — no prose, no code fences. Process EVERY trip.

TRIP fields:
- For EACH trip, use its delimiter to parse the trip_name, start year/month, status, companions and rating. Then read its DAY lines.
- base_currency: set it to "CNY".

DAYS fields:
- Each line after the === delimiter is ONE DAY, starting with a day-of-month and the city in brackets, e.g. "28（荆州）：...".
- Build full dates in SEQUENCE from the trip's start YYYY-MM: when the day number DROPS (e.g. 28 -> 1), advance to the next month (and to January + next year after December).
- "city" is not part of the "days" JSON, but part of the "stops" JSON (see STOP fields below).
- After the colon (Chinese ：or ASCII :), A day's stops are delimited by |.

STOPS fields:
- Each stop's fields are comma-separated (Chinese ， or ASCII ,).
- There can be a maximum of 5 fields in a stop: <type>,"<description>","<details>","<city>",<completion>].
- type: enums are ["travel", "visit", "eat", "shop", "stay", "other"]; required.
- description: enclosed in ""; required.
- details: enclosed in ""; nullable.
- city: enclosed in ""; if null, set it to the DAY's city.
- country: not in the file, always set it to "中国".
- completion: enums are ["done", "skipped"]; if null, set it to "done".

If anything cannot be passed, output the line number and error; if everything passes, output EXACTLY this shape (valid JSON; commas between all properties; re-read once to confirm it parses):

[
  {
    "trip_name": "string",
    "status": "want | planning | visited",
    "base_currency": "string",
    "companions": "string | null",
    "rating": "string | null",
    "days": [
      {
        "date": "YYYY-MM-DD",
        "stops": [
          {
            "type": "travel|visit|eat|shop|stay|other",
            "description": "string",
            "city": "string | null",
            "country": "string | null",
            "details": "string | null",
            "completion": "done | skipped"
          }
        ]
      }
    ]
  }
]

Return the JSON array now, and nothing else.  If the prompt is unclear or confusing, ask questions or suggest how to improve it.
```

## Step 3 — after you get the JSON

1. Skim a couple of trips — **dates** (month rolled over?), **types** (a restaurant tagged `visit`?),
   **cities** (carried forward?). Don't over-polish; the Trip Builder makes fixes easy.
2. Save as `trips.json`.
3. WellWorth → Settings → **Import JSON Trips** → pick the file → one **combined review** (trip count, stop
   counts, and **new cities** to confirm once each) → **Import** → finish trips in the Trip Builder.
   Expenses import separately (Import CSV Expenses).
