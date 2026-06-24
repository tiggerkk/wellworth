# Trip Itinerary → JSON Extraction Prompt (model-agnostic, ALL trips at once)

Use with **any** capable AI tool (Claude, Gemini, GPT, etc.) to convert your whole back-catalogue of trips
in **one pass**. Prefix each trip's text with a delimiter line, paste them all, then the prompt below. Save
the output as `trips.json` and import via WellWorth → Settings → **Import JSON Trips**. The import is a
**draft** you finish in the Trip Builder — don't aim for perfection.

## Step 1 — add a delimiter line before each trip

```
=== TRIP: 湖北 | 2026-03 | visited ===
28（六）：香港-深圳北（11:41-11:59）-荆州（12:47-19:49, ¥2067）
1（日）：楚王车马阵¥58，荆州博物馆，关羽祠¥25，...
=== TRIP: 肇庆 | 2026-01 | visited ===
30：香港-肇庆东（10:02-11:48）...
```

`=== TRIP: <name> | <YYYY-MM start> | <status> ===` gives the AI the trip name, the year/month anchor (so
day numbers like 28 → 1 roll into the next month deterministically), and status (want|planning|visited).

## Step 2 — paste this prompt, then all your delimited trips

```
You convert MANY freeform travel itineraries into one JSON array. The input is divided into trips, each
starting with a line: === TRIP: <name> | <YYYY-MM> | <status> ===. Output ONLY one JSON array — no prose,
no code fences. Process EVERY trip.

For EACH trip, use its delimiter for trip_name, the start year/month, and status. Then read its day lines.

DAYS & DATES:
- Each line after the delimiter is ONE DAY, starting with a day-of-month (often a weekday in brackets), e.g.
  "28（六）：...". Build full dates in SEQUENCE from the trip's start YYYY-MM: when the day number DROPS
  (28 -> 1), advance to the next month (and to January + next year after December).
- A day's stops are comma-separated (Chinese ， or ASCII ,). Brackets 《》【】() carry sub-notes.

STOP TYPE (by meaning):
- "travel" = INTER-CITY leg: "CityA-CityB（time-time, ¥fare）" or text with 机票/航班/飞机/高铁/动车/火车/船.
  origin -> from_loc, destination -> to_loc, set travel_mode (air|train|car|ferry), city = ARRIVAL city.
- "eat" = restaurant/food/drink (菜/餐厅/饭店/火锅/面/食/咖啡/茶/烧烤, or wrapped in 【】).
- "shop" = 沃尔玛/万达/Popmart/超市/购物/广场/mall/商城/免税/SKP.
- "stay" = 酒店/宾馆/住/hotel.
- "visit" = attractions: 博物馆/博物院, 寺/庙/祠, 公园, 故居, 古城/古镇, 石窟, 楼/塔, scenic spots. DEFAULT.
- "other" = performances/light shows/walks (表演/秀/灯光秀/巡游) and anything else.

PER-STOP FIELDS:
- "description": the place/restaurant/hotel name (for travel, null; use from_loc/to_loc).
- "city": the city the stop is in; CARRY FORWARD from the latest travel ARRIVAL or context; update when it
  changes; null if unknown. Do NOT use the trip name as a city unless it clearly is one.
- "country": "China" for Chinese itineraries unless clearly elsewhere; else the country.
- "time": "HH:MM" (arrival time for a travel range); else null.
- "cost": numeric from a ¥/$ amount; if several are added ("¥40+70"), SUM and keep the original in "details".
  null if none. "currency": "CNY" for ¥, else the code; null if no cost.
- "local_transit": for a Visit, a 《》 how-to-get-there note (metro exit, 打车, 观光车).
- "details": leftover notes (raw cost text, opening times, seat tips); else null.
- "completion": "done" normally; "skipped" if under a 没去 / 未去 / 取消 / "didn't go" heading.

Output EXACTLY this shape (valid JSON; commas between all properties; bare numbers; re-read once to confirm
it parses):

[
  {
    "trip_name": "string",
    "status": "want | planning | visited",
    "base_currency": "string",
    "days": [
      {
        "date": "YYYY-MM-DD | null",
        "stops": [
          {
            "type": "travel|visit|eat|shop|stay|other",
            "description": "string | null",
            "city": "string | null",
            "country": "string | null",
            "time": "HH:MM | null",
            "cost": 0,
            "currency": "string | null",
            "travel_mode": "air|train|car|ferry | null",
            "from_loc": "string | null",
            "to_loc": "string | null",
            "local_transit": "string | null",
            "details": "string | null",
            "completion": "done | skipped"
          }
        ]
      }
    ]
  }
]

Return the JSON array now, and nothing else.
```

## Step 3 — after you get the JSON

1. Skim a couple of trips — **dates** (month rolled over?), **types** (a restaurant tagged `visit`?),
   **cities** (carried forward?). Don't over-polish; the Trip Builder makes fixes easy.
2. Save as `trips.json`.
3. WellWorth → Settings → **Import JSON Trips** → pick the file → one **combined review** (trip count, stop
   counts, and **new cities** to confirm once each) → **Import** → finish trips in the Trip Builder.
   Expenses import separately (Import CSV Expenses).
