/**
 * Travel module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`) plus the shared place vocabulary. Pure constants
 * only — runtime helpers live in `src/lib/travel.ts` / `src/lib/travel-config.ts` / `src/lib/places.ts`.
 */

/** Trip lifecycle status. */
export const TRIP_STATUSES = ['want', 'planning', 'visited'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  want: 'Want to Visit',
  planning: 'Planning',
  visited: 'Visited',
}

/** Stop kind. `travel` = inter-city legs only; `local_transit` is a field on a `visit`. */
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

/** Mode of an inter-city travel leg (Type = travel only). */
export const TRAVEL_MODES = ['air', 'train', 'car', 'ferry'] as const
export type TravelMode = (typeof TRAVEL_MODES)[number]

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  air: 'Air',
  train: 'Train',
  car: 'Car',
  ferry: 'Ferry',
}

/** Per-stop completion. Null (unmarked) is the default and isn't represented here. */
export const COMPLETIONS = ['done', 'skipped'] as const
export type Completion = (typeof COMPLETIONS)[number]

export const COMPLETION_LABELS: Record<Completion, string> = {
  done: 'Done',
  skipped: 'Skipped',
}

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
