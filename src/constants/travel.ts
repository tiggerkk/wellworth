/**
 * Travel module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`) plus the shared place vocabulary. Pure constants
 * only — runtime helpers live in `src/lib/travel.ts` / `src/lib/travel-config.ts` / `src/lib/places.ts`.
 */

/** Trip lifecycle status. */
export const TRIP_STATUSES = ['want', 'planning', 'visited'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  want: 'Want',
  planning: 'Planning',
  visited: 'Visited',
}

/** Stop kind. `travel` = an inter-city leg; any mode/transit detail goes in the stop description. */
export const STOP_TYPES = ['travel', 'visit', 'eat', 'shop', 'stay', 'other'] as const
export type StopType = (typeof STOP_TYPES)[number]

export const STOP_TYPE_LABELS: Record<StopType, string> = {
  travel: 'Travel',
  visit: 'Visit',
  eat: 'Eat',
  shop: 'Shop',
  stay: 'Stay',
  other: 'Other',
}

/**
 * Per-stop-type icon accent colour (CSS custom-property refs, à la Net Worth's `ASSET_TYPE_COLORS`),
 * so the itinerary stop icons read apart by kind. Hues jump across the wheel — no two adjacent types
 * share a warm/cool band. Consumed by `StopTypeIcon`.
 * travel(plane)=green · visit(camera)=gold · eat(chopsticks)=red · shop(shopee)=blue ·
 * stay(bed)=purple · other(map-pin)=grey.
 */
export const STOP_TYPE_COLORS: Record<StopType, string> = {
  travel: 'var(--color-positive)', // green
  visit: 'var(--color-dynasty)', // gold
  eat: 'var(--color-danger)', // red
  shop: 'var(--color-cat-activity)', // blue
  stay: 'var(--color-cat-supplement)', // purple
  other: 'var(--color-text-tertiary)', // grey (darker than text-muted, so it reads apart from the row text)
}

/** Per-stop completion. Null (unmarked) is the default and isn't represented here. */
export const COMPLETIONS = ['done', 'skipped'] as const
export type Completion = (typeof COMPLETIONS)[number]

/**
 * The default expense categories + their initial display order. These are only the **seed defaults**:
 * the owner can add/rename/delete/reorder them in Travel Settings (stored on
 * `profile.travel_expense_categories`). `trip_expense.category` stores the stable `key`; see
 * `src/lib/travel-config.ts`. Keys/labels are chosen so the Import CSV Expenses headers
 * (`Local Transit`, `Flight/Train`, …) match by label via `matchKeyOrLabel`.
 */
export const TRAVEL_EXPENSE_CATEGORIES = [
  'restaurant',
  'takeout',
  'groceries',
  'shopping',
  'activity',
  'local_transit',
  'flight_train',
  'hotel',
] as const
export type TravelExpenseCategory = (typeof TRAVEL_EXPENSE_CATEGORIES)[number]

export const TRAVEL_EXPENSE_CATEGORY_LABELS: Record<TravelExpenseCategory, string> = {
  restaurant: 'Restaurant',
  takeout: 'Take-out',
  groceries: 'Groceries',
  shopping: 'Shopping',
  activity: 'Activity',
  local_transit: 'Local Transit',
  flight_train: 'Flight/Train',
  hotel: 'Hotel',
}

/**
 * The swatch palette for **expense-category colours** — the choices offered by the per-row colour
 * picker in Travel Settings → Expense Categories, and the default-assignment cycle for seed / new
 * categories (`src/lib/travel-config.ts`). Values are design tokens (CSS vars) so they track the theme;
 * the one literal cyan has no matching token (mirrors the donut fallback palette in `TravelExpenseChart`).
 * The category's chosen colour is stored per entry on `profile.travel_expense_categories` and drives the
 * **stable** per-category slice colour in the Expenses donut.
 */
export const TRAVEL_CATEGORY_COLORS = [
  { name: 'Blue', value: 'var(--color-accent)' },
  { name: 'Green', value: 'var(--color-positive)' },
  { name: 'Orange', value: 'var(--color-warning)' },
  { name: 'Rose', value: 'var(--color-favorite)' },
  { name: 'Gold', value: 'var(--color-dynasty)' },
  { name: 'Purple', value: 'var(--color-cat-supplement)' },
  { name: 'Cyan', value: '#54b3c4' },
  { name: 'Red', value: 'var(--color-danger)' },
  { name: 'Grey', value: 'var(--color-text-secondary)' },
] as const

/** Neutral fallback for an orphan/unconfigured category colour (e.g. a deleted category still on a row). */
export const TRAVEL_CATEGORY_COLOR_FALLBACK = 'var(--color-text-secondary)'

/**
 * Currency codes offered in the trip/stop/expense currency pickers (ISO 4217). The owner can travel
 * anywhere, so this is a convenience shortlist (CNY first — most trips are domestic), not a hard limit;
 * stored values are plain `string` so an unlisted code still round-trips. HKD is the conversion base.
 */
export const CURRENCIES = [
  'CNY',
  'HKD',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'KRW',
  'TWD',
  'SGD',
  'THB',
  'MYR',
  'VND',
  'AUD',
  'CAD',
  'CHF',
] as const

/**
 * The 34 province-level divisions of China, as **bare canonical names** (no 省/市/自治区/特别行政区
 * suffix), matching how the owner stores `stop.province` (e.g. 湖北, not 湖北省). This is the single
 * source of truth for the city resolver, the shaded province map, and the "N / 34" denominator —
 * not derived from Nominatim (which geocodes places, not admin totals).
 *
 * The bundled DataV.GeoAtlas GeoJSON ships suffixed names (北京市, 广西壮族自治区, …); a
 * DataV → canonical normalization map and a build-time name-match check live with the map renderer
 * (Milestone 4). Any province name from the geocode assist is snapped to one of these before saving.
 *
 * 4 municipalities + 23 provinces (incl. 台湾) + 5 autonomous regions + 2 SARs = 34.
 */
export const CHINA_PROVINCES = [
  // Municipalities (4)
  '北京',
  '天津',
  '上海',
  '重庆',
  // Provinces (23)
  '河北',
  '山西',
  '辽宁',
  '吉林',
  '黑龙江',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '海南',
  '四川',
  '贵州',
  '云南',
  '陕西',
  '甘肃',
  '青海',
  '台湾',
  // Autonomous regions (5)
  '内蒙古',
  '广西',
  '西藏',
  '宁夏',
  '新疆',
  // Special administrative regions (2)
  '香港',
  '澳门',
] as const
export type ChinaProvince = (typeof CHINA_PROVINCES)[number]
