import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconChevronDown,
  IconChevronRight,
  IconMapPin,
  IconWorldSearch,
} from '@tabler/icons-react'
import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { SearchBar } from './SearchBar'
import { SelectMenu } from './SelectMenu'
import { PrimaryButton } from './PrimaryButton'
import { useAsync } from '../hooks/useAsync'
import { listRememberedCities, rememberCity } from '../data/travel'
import { geocodeCity, snapProvince, type GeocodeSuggestion } from '../lib/travel-places'
import { CHINA_PROVINCES } from '../constants/travel'
import type { ResolvedCity } from '../lib/travel'
import { foldZh } from '../lib/zh-fold'

interface CitySearchOverlayProps {
  userId: string
  initialQuery?: string
  onSelect: (city: ResolvedCity) => void
  onClose: () => void
}

const CHINA_NAMES = new Set(['china', '中国', 'cn', "people's republic of china"])
const isChina = (country: string) => CHINA_NAMES.has(country.trim().toLowerCase())

/**
 * The City picker — a **local** fixed overlay (not a route sheet, so the Trip Builder's draft
 * survives). Seeded with the stop's current City, it searches the remembered-cities cache (instant)
 * and Nominatim (auto, debounced) and lists matches immediately.
 * Selecting a result confirms it and returns; manual entry is the fallback, collapsed by default and
 * auto-expanded when search finds nothing. Province is snapped to a canonical `CHINA_PROVINCES` value
 * before saving so the shaded map stays consistent. Confirming a city upserts it into the cache.
 */
export function CitySearchOverlay({
  userId,
  initialQuery = '',
  onSelect,
  onClose,
}: CitySearchOverlayProps) {
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery)
  const [country, setCountry] = useState('中国')
  const [province, setProvince] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [manualOpen, setManualOpen] = useState(false)

  const loadCache = useCallback(() => listRememberedCities(userId), [userId])
  const { data: cache } = useAsync(loadCache)

  const matches = useMemo(() => {
    const q = foldZh(query.trim())
    if (!q) return []
    return (cache ?? []).filter((c) => foldZh(c.city).includes(q)).slice(0, 8)
  }, [cache, query])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350)
    return () => clearTimeout(t)
  }, [query])

  // Auto-expand the manual section when search is done and found nothing.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (geoState === 'done' && suggestions.length === 0 && debounced.trim()) {
      setManualOpen(true)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [geoState, suggestions.length, debounced])

  // Auto-run the Nominatim assist on open and as the typed city settles.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const term = debounced.trim()
    if (!term) {
      setSuggestions([])
      setGeoState('idle')
      return
    }
    let cancelled = false
    setGeoState('loading')
    /* eslint-enable react-hooks/set-state-in-effect */
    geocodeCity(term)
      .then((r) => {
        if (!cancelled) setSuggestions(r)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setGeoState('done')
      })
    return () => {
      cancelled = true
    }
  }, [debounced])

  async function confirm(resolved: ResolvedCity) {
    await rememberCity(userId, resolved)
    onSelect(resolved)
  }

  function selectSuggestion(s: GeocodeSuggestion) {
    void confirm({
      city: s.city || query.trim(),
      country: s.country || 'China',
      province: isChina(s.country) ? snapProvince(s.province) : (s.province ?? null),
      lat: s.lat,
      lng: s.lng,
    })
  }

  function useManual() {
    const city = query.trim()
    if (!city || !country.trim()) return
    void confirm({
      city,
      country: country.trim(),
      province: isChina(country) ? snapProvince(province) : province.trim() || null,
      lat: null,
      lng: null,
    })
  }

  return (
    <OverlayTop onClose={onClose} label="Pick a city">
      <ScreenHeaderTitle onClose={onClose}>
        <div className="flex-1">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="City name"
            icon={IconWorldSearch}
          />
        </div>
      </ScreenHeaderTitle>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* Remembered cities (instant, no network) */}
        {matches.length > 0 && (
          <section className="mb-4">
            <h2 className="mb-2 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
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
                  <span className="flex-1 truncate text-body text-text-primary">
                    {c.city}
                  </span>
                  <span className="shrink-0 text-caption text-text-secondary">
                    {[c.province, c.country].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Geocode results (auto) */}
        <section className="mb-4">
          <h2 className="mb-2 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
            Search results
          </h2>
          <div className="overflow-hidden rounded-card border border-border">
            {suggestions.map((s, i) => (
              <button
                key={`${s.lat},${s.lng},${i}`}
                onClick={() => selectSuggestion(s)}
                className="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 active:bg-input/40"
              >
                <IconMapPin size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-text-primary">
                    {s.city || s.displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-text-secondary">
                    {[s.province, s.country].filter(Boolean).join(' · ') || s.displayName}
                  </span>
                </span>
              </button>
            ))}
            {suggestions.length === 0 && (
              <p className="px-4 py-6 text-center text-body text-text-tertiary">
                {!debounced.trim()
                  ? 'Type a city to search.'
                  : geoState === 'loading'
                    ? 'Searching…'
                    : 'No matches — enter the details manually below.'}
              </p>
            )}
          </div>
        </section>

        {/* Manual entry / confirmation — collapsed by default; auto-expands on zero results */}
        <section className="flex flex-col gap-3">
          <button
            onClick={() => setManualOpen((v) => !v)}
            className="flex items-center gap-1 px-1 text-label text-text-secondary"
          >
            {manualOpen ? (
              <IconChevronDown size={14} className="shrink-0" />
            ) : (
              <IconChevronRight size={14} className="shrink-0" />
            )}
            Enter manually…
          </button>
          {manualOpen && (
            <>
              <label className="text-caption text-text-secondary">
                Country
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1 field-control w-full"
                />
              </label>
              <div className="text-caption text-text-secondary">
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
                    className="mt-1 field-control w-full"
                  />
                )}
              </div>
              <PrimaryButton
                onClick={useManual}
                disabled={!query.trim() || !country.trim()}
              >
                {'Use "' + (query.trim() || 'city') + '"'}
              </PrimaryButton>
            </>
          )}
        </section>
      </div>
    </OverlayTop>
  )
}
