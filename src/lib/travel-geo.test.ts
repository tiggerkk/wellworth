import { describe, expect, it } from 'vitest'
// `?raw` imports (declared by vite/client) read the vendored assets as strings — no node:fs, so this
// also typechecks under tsconfig.app (types: ["vite/client"]).
import chinaRaw from '../../public/geo/china-provinces.geojson?raw'
import worldRaw from '../../public/geo/world-countries.geojson?raw'
import { CHINA_PROVINCES } from '../constants/travel'
import { snapProvince } from './travel-places'
import { COUNTRY_ALIASES, resolveCountryName } from './travel-geo'

/**
 * Build-time name-match guard (the M4 decision): the bundled GeoJSON must cover every region the app
 * can shade, so a name drift between `CHINA_PROVINCES` / `COUNTRY_ALIASES` and the vendored files fails
 * here rather than silently leaving a province/country unshaded.
 */
interface GeoCollection {
  features: { properties: Record<string, unknown> }[]
}

describe('China province GeoJSON ↔ CHINA_PROVINCES', () => {
  const china = JSON.parse(chinaRaw) as GeoCollection
  const resolved = new Set(
    china.features.map((f) => snapProvince(f.properties.name as string)),
  )

  it('every CHINA_PROVINCES name resolves to a bundled shape', () => {
    const missing = CHINA_PROVINCES.filter((p) => !resolved.has(p))
    expect(missing).toEqual([])
  })
})

describe('world-countries GeoJSON ↔ country resolution', () => {
  const world = JSON.parse(worldRaw) as GeoCollection
  const neNames = new Set(world.features.map((f) => f.properties.NAME as string))

  it('every COUNTRY_ALIASES target exists in the NE file', () => {
    const targets = [...new Set(Object.values(COUNTRY_ALIASES))]
    const bad = targets.filter((n) => !neNames.has(n))
    expect(bad).toEqual([])
  })

  it('resolves exact, aliased, and unknown country names', () => {
    expect(resolveCountryName('China', neNames)).toBe('China')
    expect(resolveCountryName('japan', neNames)).toBe('Japan') // case-insensitive exact
    expect(resolveCountryName('USA', neNames)).toBe('United States of America') // alias
    expect(resolveCountryName('UK', neNames)).toBe('United Kingdom')
    expect(resolveCountryName('Atlantis', neNames)).toBeNull()
    expect(resolveCountryName(null, neNames)).toBeNull()
  })
})
