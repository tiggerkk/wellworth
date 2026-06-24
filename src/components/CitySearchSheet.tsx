import { useCallback, useMemo, useState } from 'react'
import { IconMapPin, IconSearch, IconWorldSearch, IconX } from '@tabler/icons-react'
import { SearchBar } from './SearchBar'
import { SelectMenu } from './SelectMenu'
import { PrimaryButton } from './PrimaryButton'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { listRememberedCities, rememberCity } from '../data/travel'
import { geocodeCity, snapProvince, type GeocodeSuggestion } from '../lib/places'
import { CHINA_PROVINCES } from '../constants/travel'
import type { ResolvedCity } from '../lib/travel'

interface CitySearchSheetProps {
  userId: string
  initialQuery?: string
  onSelect: (city: ResolvedCity) => void
  onClose: () => void
}

const CHINA_NAMES = new Set(['china', '中国', 'cn', "people's republic of china"])
const isChina = (country: string) => CHINA_NAMES.has(country.trim().toLowerCase())

/**
 * The City picker — a **local** fixed overlay (not a route sheet, so the Trip Builder's draft survives).
 * Resolution is manual + the remembered-cities cache; Nominatim is an on-demand assist. Confirming a
 * city upserts it into the cache and hands a `ResolvedCity` back to the stop. Province is snapped to a
 * canonical `CHINA_PROVINCES` value before saving so the shaded map stays consistent.
 */
export function CitySearchSheet({
  userId,
  initialQuery = '',
  onSelect,
  onClose,
}: CitySearchSheetProps) {
  useEscapeKey(onClose)

  const [query, setQuery] = useState(initialQuery)
  const [country, setCountry] = useState('China')
  const [province, setProvince] = useState('')
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  })
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'done'>('idle')

  const loadCache = useCallback(() => listRememberedCities(userId), [userId])
  const { data: cache } = useAsync(loadCache)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return (cache ?? []).filter((c) => c.city.toLowerCase().includes(q)).slice(0, 8)
  }, [cache, query])

  async function lookUp() {
    setGeoState('loading')
    const results = await geocodeCity(query)
    setSuggestions(results)
    setGeoState('done')
  }

  function applySuggestion(s: GeocodeSuggestion) {
    if (s.city) setQuery(s.city)
    setCountry(s.country || 'China')
    setProvince(s.province ?? '')
    setCoords({ lat: s.lat, lng: s.lng })
    setSuggestions([])
  }

  async function confirm(resolved: ResolvedCity) {
    await rememberCity(userId, resolved)
    onSelect(resolved)
  }

  function useManual() {
    const city = query.trim()
    if (!city || !country.trim()) return
    void confirm({
      city,
      country: country.trim(),
      province: isChina(country) ? snapProvince(province) : province.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
    })
  }

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pick a city"
        className="absolute inset-0 flex flex-col bg-surface pt-[env(safe-area-inset-top)]"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={onClose} aria-label="Close" className="text-text-secondary">
            <IconX size={22} />
          </button>
          <div className="flex-1">
            <SearchBar value={query} onChange={setQuery} placeholder="City name" />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Remembered cities (instant, no network) */}
          {matches.length > 0 && (
            <section className="mb-4">
              <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
                Remembered
              </h2>
              <div className="overflow-hidden rounded-card border border-border">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      void confirm({
                        city: c.city,
                        country: c.country,
                        province: c.province,
                        lat: c.lat,
                        lng: c.lng,
                      })
                    }
                    className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 active:bg-input/40"
                  >
                    <IconMapPin size={16} className="shrink-0 text-text-tertiary" />
                    <span className="flex-1 truncate text-[15px] text-text-primary">
                      {c.city}
                    </span>
                    <span className="shrink-0 text-xs text-text-secondary">
                      {[c.province, c.country].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Geocode assist (on demand) */}
          <button
            onClick={() => void lookUp()}
            disabled={!query.trim() || geoState === 'loading'}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-input bg-input px-3 py-2 text-sm text-text-primary disabled:opacity-50"
          >
            <IconWorldSearch size={16} />
            {geoState === 'loading' ? 'Searching…' : 'Look up online (optional)'}
          </button>
          {geoState === 'done' && suggestions.length === 0 && (
            <p className="mb-3 px-1 text-xs text-text-secondary">
              No matches — enter the details manually below.
            </p>
          )}
          {suggestions.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-card border border-border">
              {suggestions.map((s, i) => (
                <button
                  key={`${s.lat},${s.lng},${i}`}
                  onClick={() => applySuggestion(s)}
                  className="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 active:bg-input/40"
                >
                  <IconSearch size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
                  <span className="flex-1 text-[13px] text-text-primary">
                    {s.displayName}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Manual entry / confirmation */}
          <section className="flex flex-col gap-3">
            <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
              Details
            </h2>
            <label className="text-xs text-text-secondary">
              Country
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
              />
            </label>
            <div className="text-xs text-text-secondary">
              Province / Region
              {isChina(country) ? (
                <div className="mt-1">
                  <SelectMenu
                    value={province}
                    onChange={setProvince}
                    ariaLabel="Province"
                    placeholder="Select a province"
                    options={[
                      { value: '', label: '—' },
                      ...CHINA_PROVINCES.map((p) => ({ value: p, label: p })),
                    ]}
                  />
                </div>
              ) : (
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
                />
              )}
            </div>
            {coords.lat != null && (
              <p className="px-1 text-xs text-text-tertiary">
                Pin: {coords.lat.toFixed(3)}, {coords.lng?.toFixed(3)}
              </p>
            )}
            <PrimaryButton
              onClick={useManual}
              disabled={!query.trim() || !country.trim()}
            >
              Use “{query.trim() || 'city'}”
            </PrimaryButton>
          </section>
        </div>
      </div>
    </div>
  )
}
