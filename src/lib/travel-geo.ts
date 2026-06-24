/**
 * Map-fill name resolution for the layered region shading (M4). Two bundled GeoJSON assets back the
 * fill (served from `public/geo/`, fetched on demand by the lazy map chunk — not in the JS bundle):
 *   - DataV.GeoAtlas China provinces (`china-provinces.geojson`) — Chinese province names; matched to
 *     `CHINA_PROVINCES` via `snapProvince` (see `src/lib/places.ts`).
 *   - Natural Earth world countries (`world-countries.geojson`, public domain) — `NAME` property;
 *     matched to a stop's `country` via `resolveCountryName` below.
 *
 * `CHINA_PROVINCES` is the single source of truth; the build-time check in `travel-geo.test.ts` asserts
 * every province resolves in the DataV file and every `COUNTRY_ALIASES` target exists in the NE file, so
 * a name drift fails the test rather than silently leaving a region unshaded. Province/state fill
 * *outside* China is parked — non-China countries are filled whole.
 */

/** Public paths of the vendored GeoJSON assets (served from `public/`, honoring the Vite base URL). */
export const CHINA_GEOJSON_URL = `${import.meta.env.BASE_URL}geo/china-provinces.geojson`
export const WORLD_GEOJSON_URL = `${import.meta.env.BASE_URL}geo/world-countries.geojson`

/**
 * Lower-cased free-text country → exact Natural Earth `NAME`. Only the spellings NE doesn't match
 * verbatim need an entry; everything else resolves by case-insensitive exact match. Targets are
 * asserted to exist in the NE file by the build test.
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  china: 'China',
  中国: 'China',
  prc: 'China',
  "people's republic of china": 'China',
  usa: 'United States of America',
  us: 'United States of America',
  'u.s.': 'United States of America',
  'u.s.a.': 'United States of America',
  'united states': 'United States of America',
  america: 'United States of America',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  korea: 'South Korea',
  'south korea': 'South Korea',
  'republic of korea': 'South Korea',
  'north korea': 'North Korea',
  vietnam: 'Vietnam',
  'viet nam': 'Vietnam',
  russia: 'Russia',
  czechia: 'Czechia',
  'czech republic': 'Czechia',
  uae: 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
  laos: 'Laos',
  myanmar: 'Myanmar',
  burma: 'Myanmar',
}

/**
 * Resolve a stop's free-text `country` to a Natural Earth `NAME` present in `neNames`, or null when it
 * can't be matched (the country simply isn't shaded — the city dot still shows). Tries exact, then
 * case-insensitive exact, then the alias table.
 */
export function resolveCountryName(
  raw: string | null | undefined,
  neNames: Set<string>,
): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (!t) return null
  if (neNames.has(t)) return t
  const lower = t.toLowerCase()
  for (const n of neNames) if (n.toLowerCase() === lower) return n
  const alias = COUNTRY_ALIASES[lower]
  return alias && neNames.has(alias) ? alias : null
}
