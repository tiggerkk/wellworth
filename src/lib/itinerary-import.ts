/**
 * Itinerary AI-import (M7) — accepts a **JSON array of trips** (shape =
 * `templates/travel-itinerary.schema.json`, produced outside the app by any AI tool from freeform
 * itinerary text via `templates/travel-itinerary-prompt.md`). Pure: no I/O. Applies the same tolerant
 * JSON repair as Medical (stray quote after a number; a missing comma before a new key), then validates
 * each trip into a draft (days preserve null dates; stops keep order; enums fall back safely; province is
 * snapped to a canonical `CHINA_PROVINCES` value for Chinese stops). The review screen
 * (`ImportTravelTripsSheet`) confirms trip/day/stop counts + pooled new cities before writing drafts the
 * owner finishes in the Trip Builder.
 */
import { snapProvince } from './places'
import { isChinaCountry } from './travel-stats'
import {
  STOP_TYPES,
  TRIP_STATUSES,
  type StopType,
  type TripStatus,
} from '../constants/travel'

export interface StopDraft {
  type: StopType
  description: string | null
  city: string | null
  country: string | null
  province: string | null
  details: string | null
  completion: 'done' | 'skipped' | null
}

export interface DayDraft {
  date: string | null
  stops: StopDraft[]
}

export interface TripDraft {
  name: string
  status: TripStatus
  base_currency: string
  days: DayDraft[]
}

export type ItineraryParse =
  | { ok: true; trips: TripDraft[]; warnings: string[] }
  | { ok: false; error: string }

// ── tolerant JSON repair (mirrors medical-import) ───────────────────────────────────────────
const repairStrayQuote = (s: string) =>
  s.replace(/(:\s*-?\d+(?:\.\d+)?)"(?=\s*[,}\]\r\n])/g, '$1')
const insertMissingCommas = (s: string) =>
  s.replace(/(["\d\]}])(\s*\r?\n\s*)(")/g, '$1,$2$3')

function jsonError(text: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const m = /position (\d+)/.exec(msg)
  if (m) {
    const pos = Number(m[1])
    const before = text.slice(0, pos)
    const line = before.split('\n').length
    const col = pos - before.lastIndexOf('\n')
    return `Couldn’t parse the JSON (line ${line}, column ${col}). Check for a missing comma or a stray quote near there.`
  }
  return `Couldn’t parse the JSON: ${msg}`
}

function tolerantParse(raw: string): { data: unknown } | { error: string } {
  for (const candidate of [
    raw,
    repairStrayQuote(raw),
    insertMissingCommas(repairStrayQuote(raw)),
  ]) {
    try {
      return { data: JSON.parse(candidate) }
    } catch {
      /* try the next repair */
    }
  }
  try {
    JSON.parse(raw)
    return { error: 'Couldn’t parse the JSON.' }
  } catch (e) {
    return { error: jsonError(raw, e) }
  }
}

// ── coercion ────────────────────────────────────────────────────────────────────────────────
const STOP_TYPE_SET = new Set<string>(STOP_TYPES)
const STATUS_SET = new Set<string>(TRIP_STATUSES)

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s === '' ? null : s
}
function asDate(v: unknown): string | null {
  const s = strOrNull(v)
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function toStop(raw: unknown): StopDraft {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >
  const typeStr = strOrNull(o.type)
  const type = (typeStr && STOP_TYPE_SET.has(typeStr) ? typeStr : 'other') as StopType
  const country = strOrNull(o.country)
  const rawProvince = strOrNull(o.province)
  // Chinese stops snap to a canonical CHINA_PROVINCES name; foreign provinces are kept verbatim.
  const province = isChinaCountry(country) ? snapProvince(rawProvince) : rawProvince
  return {
    type,
    description: strOrNull(o.description),
    city: strOrNull(o.city),
    country,
    province,
    details: strOrNull(o.details),
    completion:
      strOrNull(o.completion) === 'skipped'
        ? 'skipped'
        : strOrNull(o.completion) === 'done'
          ? 'done'
          : null,
  }
}

export function parseItineraryJson(raw: string): ItineraryParse {
  if (!raw.trim()) return { ok: false, error: 'The file is empty.' }
  const parsed = tolerantParse(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  if (!Array.isArray(parsed.data)) {
    return { ok: false, error: 'Expected a JSON array of trips.' }
  }

  const trips: TripDraft[] = []
  const warnings: string[] = []
  parsed.data.forEach((rawTrip, i) => {
    const o = (typeof rawTrip === 'object' && rawTrip !== null ? rawTrip : {}) as Record<
      string,
      unknown
    >
    const name = strOrNull(o.trip_name)
    if (!name) {
      warnings.push(`Trip ${i + 1}: missing trip_name — skipped.`)
      return
    }
    const statusStr = strOrNull(o.status)
    const status = (
      statusStr && STATUS_SET.has(statusStr) ? statusStr : 'visited'
    ) as TripStatus
    const base_currency = strOrNull(o.base_currency) ?? 'CNY'
    const rawDays = Array.isArray(o.days) ? o.days : []
    const days: DayDraft[] = rawDays.map((rawDay) => {
      const d = (typeof rawDay === 'object' && rawDay !== null ? rawDay : {}) as Record<
        string,
        unknown
      >
      const stops = (Array.isArray(d.stops) ? d.stops : []).map(toStop)
      return { date: asDate(d.date), stops }
    })
    if (days.length === 0) warnings.push(`“${name}”: no days.`)
    trips.push({ name, status, base_currency, days })
  })

  if (trips.length === 0 && warnings.length === 0) {
    return { ok: false, error: 'No trips found in the file.' }
  }
  return { ok: true, trips, warnings }
}

export interface DistinctCity {
  city: string
  country: string | null
  province: string | null
}

/** Distinct cities across all trips (first occurrence's country/province), for the new-city review. */
export function distinctCities(trips: TripDraft[]): DistinctCity[] {
  const seen = new Map<string, DistinctCity>()
  for (const t of trips) {
    for (const d of t.days) {
      for (const s of d.stops) {
        if (!s.city) continue
        const key = s.city.trim().toLowerCase()
        if (!seen.has(key)) {
          seen.set(key, { city: s.city, country: s.country, province: s.province })
        }
      }
    }
  }
  return [...seen.values()]
}

export interface TripSummary {
  days: number
  stops: number
  byType: Partial<Record<StopType, number>>
}

export function tripSummary(trip: TripDraft): TripSummary {
  const byType: Partial<Record<StopType, number>> = {}
  let stops = 0
  for (const d of trip.days) {
    for (const s of d.stops) {
      stops += 1
      byType[s.type] = (byType[s.type] ?? 0) + 1
    }
  }
  return { days: trip.days.length, stops, byType }
}
