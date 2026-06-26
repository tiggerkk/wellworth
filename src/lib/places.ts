/**
 * Place resolution helpers for Travel. City → country/province is **manual + a remembered-cities
 * cache** (see `src/data/travel.ts`); Nominatim is **assist-only** (suggests country/admin-1/coords to
 * confirm), never a hard dependency — a manual entry always works.
 *
 * `snapProvince` is the bridge that keeps the stored `stop.province` aligned with `CHINA_PROVINCES`
 * (the single source of truth for the shaded map + "N / 34" count): every province string — whether
 * typed, cached, or returned by the geocoder — is snapped to a canonical bare name before saving, so
 * the map can never be left unshaded by a spelling mismatch. Returns null when it isn't a recognized
 * Chinese province (e.g. a foreign admin-1), which callers store as-is.
 */
import { CHINA_PROVINCES, type ChinaProvince } from '../constants/travel'
import { searchZhVariants } from './zh-query'

const CANONICAL = new Set<string>(CHINA_PROVINCES)

/**
 * Aliases → canonical `CHINA_PROVINCES` name. Covers DataV/printed Chinese forms (suffixed names and
 * the ethnic-qualified autonomous regions, which a naive suffix-strip would miss) and the English
 * admin-1 names Nominatim returns. Lower-cased English is matched separately (see `snapProvince`).
 */
const PROVINCE_ALIASES: Record<string, ChinaProvince> = {
  // Municipalities
  北京市: '北京',
  天津市: '天津',
  上海市: '上海',
  重庆市: '重庆',
  // SARs
  香港特别行政区: '香港',
  澳门特别行政区: '澳门',
  // Autonomous regions (ethnic-qualified full names)
  内蒙古自治区: '内蒙古',
  广西壮族自治区: '广西',
  西藏自治区: '西藏',
  宁夏回族自治区: '宁夏',
  新疆维吾尔自治区: '新疆',
}

/** English admin-1 names (lower-cased) → canonical. Matched by exact, then longest-prefix. */
const EN_ALIASES: [string, ChinaProvince][] = [
  ['beijing', '北京'],
  ['tianjin', '天津'],
  ['shanghai', '上海'],
  ['chongqing', '重庆'],
  ['hebei', '河北'],
  ['shanxi', '山西'],
  ['shaanxi', '陕西'],
  ['liaoning', '辽宁'],
  ['jilin', '吉林'],
  ['heilongjiang', '黑龙江'],
  ['jiangsu', '江苏'],
  ['zhejiang', '浙江'],
  ['anhui', '安徽'],
  ['fujian', '福建'],
  ['jiangxi', '江西'],
  ['shandong', '山东'],
  ['henan', '河南'],
  ['hubei', '湖北'],
  ['hunan', '湖南'],
  ['guangdong', '广东'],
  ['hainan', '海南'],
  ['sichuan', '四川'],
  ['guizhou', '贵州'],
  ['yunnan', '云南'],
  ['gansu', '甘肃'],
  ['qinghai', '青海'],
  ['taiwan', '台湾'],
  ['inner mongolia', '内蒙古'],
  ['guangxi', '广西'],
  ['tibet', '西藏'],
  ['xizang', '西藏'],
  ['ningxia', '宁夏'],
  ['xinjiang', '新疆'],
  ['hong kong', '香港'],
  ['macau', '澳门'],
  ['macao', '澳门'],
]

/** Snap a raw province/admin-1 string to a canonical `CHINA_PROVINCES` name, or null if unrecognized. */
export function snapProvince(raw: string | null | undefined): ChinaProvince | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (CANONICAL.has(trimmed)) return trimmed as ChinaProvince
  if (PROVINCE_ALIASES[trimmed]) return PROVINCE_ALIASES[trimmed]

  // Chinese: strip the admin-type suffix and re-check (handles plain 省/市 forms).
  const stripped = trimmed.replace(/(省|市|特别行政区|自治区)$/u, '')
  if (CANONICAL.has(stripped)) return stripped as ChinaProvince

  // English: exact first, then longest matching prefix (handles "Tibet Autonomous Region").
  const lower = trimmed.toLowerCase()
  const exact = EN_ALIASES.find(([en]) => en === lower)
  if (exact) return exact[1]
  const prefix = EN_ALIASES.filter(([en]) => lower.startsWith(en)).sort(
    (a, b) => b[0].length - a[0].length,
  )[0]
  return prefix ? prefix[1] : null
}

/** A geocoder suggestion the City picker shows for the user to confirm. */
export interface GeocodeSuggestion {
  displayName: string
  city: string
  country: string
  province: string | null
  lat: number
  lng: number
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const TIMEOUT_MS = 8000

interface NominatimResult {
  display_name?: string
  lat?: string
  lon?: string
  name?: string
  address?: Record<string, string>
}

/** Pull the best city-like label from a Nominatim address block. Pure (exported for tests). */
export function cityFromAddress(addr: Record<string, string>, fallback: string): string {
  return (
    addr.city ??
    addr.town ??
    addr.village ??
    addr.municipality ??
    addr.county ??
    addr.state_district ??
    fallback
  )
}

/** Map a raw Nominatim result to a suggestion (province snapped to canonical). Pure (exported for tests). */
export function toSuggestion(r: NominatimResult): GeocodeSuggestion | null {
  const lat = Number(r.lat)
  const lng = Number(r.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const addr = r.address ?? {}
  return {
    displayName: r.display_name ?? r.name ?? '',
    city: cityFromAddress(addr, r.name ?? ''),
    country: addr.country ?? '',
    province: snapProvince(addr.state ?? addr.region ?? addr.province ?? null),
    lat,
    lng,
  }
}

/**
 * Geocode a free-text place via Nominatim (keyless, CORS-enabled). Assist-only and on-demand (a button
 * press, never per-keystroke), so we stay within the usage policy. Returns [] on any failure — the
 * caller always falls back to manual entry.
 */
export async function geocodeCity(
  query: string,
  opts: { signal?: AbortSignal } = {},
): Promise<GeocodeSuggestion[]> {
  // CJK queries are geocoded in both Simplified and HK-Traditional, merged + de-duped on
  // coordinates, so either input variant finds the city (see `searchZhVariants`).
  return searchZhVariants(
    query,
    (q) => geocodeCityOne(q, opts),
    (s) => `${s.lat},${s.lng}`,
  )
}

async function geocodeCityOne(
  q: string,
  opts: { signal?: AbortSignal },
): Promise<GeocodeSuggestion[]> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&accept-language=zh&limit=5`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const signal = opts.signal
    ? anySignal([opts.signal, controller.signal])
    : controller.signal
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const json: unknown = await res.json()
    if (!Array.isArray(json)) return []
    return (json as NominatimResult[])
      .map(toSuggestion)
      .filter((s): s is GeocodeSuggestion => s !== null)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** Combine abort signals (caller cancel + our timeout) without AbortSignal.any (newer-runtime gap). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const s of signals) {
    if (s.aborted) {
      controller.abort()
      break
    }
    s.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}
