import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { snapProvince } from '../lib/travel-places'
import {
  CHINA_GEOJSON_URL,
  WORLD_GEOJSON_URL,
  resolveCountryName,
} from '../lib/travel-geo'

export interface MapCity {
  key: string
  city: string
  lat: number
  lng: number
  anyVisited: boolean
  trips: { id: string; name: string; status: string }[]
}

interface Props {
  cities: MapCity[]
  /** Canonical CHINA_PROVINCES names visited (drives the China province fill). */
  visitedProvinces: string[]
  /** Raw non-China country strings visited (resolved to Natural Earth names for the world fill). */
  visitedCountries: string[]
  showFill: boolean
  onSelectCity: (city: MapCity) => void
}

const FILL = '#5dcaa5' // --color-positive (teal) — matches the "Visited" status
const DOT_VISITED = '#e8623c' // --color-accent (coral)
const DOT_PLANNED = '#9aa3b5' // --color-text-secondary (neutral)

interface FeatureProps {
  name?: string
  NAME?: string
}

function dotIcon(visited: boolean): L.DivIcon {
  const color = visited ? DOT_VISITED : DOT_PLANNED
  return L.divIcon({
    className: 'travel-dot',
    html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:${color};border:2px solid #161b28;box-shadow:0 0 0 1px rgba(255,255,255,0.35)"></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

/**
 * The Leaflet map (imperative — no react-leaflet). Lazy-loaded by `TravelMap` so Leaflet + markercluster
 * land in their own chunk. OSM tiles (keyless); markercluster city dots coloured by status; an optional
 * layered region fill — China by province (DataV) + non-China countries whole (Natural Earth) — matched
 * on `CHINA_PROVINCES` / Natural Earth `NAME`. Coords are WGS-84; the GCJ-02 offset isn't corrected (v1).
 */
export function TravelMapCanvas({
  cities,
  visitedProvinces,
  visitedCountries,
  showFill,
  onSelectCity,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const chinaRef = useRef<L.GeoJSON | null>(null)
  const worldRef = useRef<L.GeoJSON | null>(null)
  const neNamesRef = useRef<Set<string>>(new Set())
  // Latest props for the imperative layers, read without re-creating the map.
  const stateRef = useRef({
    cities,
    visitedProvinces,
    visitedCountries,
    showFill,
    onSelectCity,
  })
  stateRef.current = {
    cities,
    visitedProvinces,
    visitedCountries,
    showFill,
    onSelectCity,
  }

  // Create the map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { attributionControl: true }).setView([34, 105], 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map)
    mapRef.current = map

    const cluster = L.markerClusterGroup({ maxClusterRadius: 45 })
    cluster.addTo(map)
    clusterRef.current = cluster

    // Fetch the bundled GeoJSON, then build the two fill layers.
    void Promise.all([
      fetch(CHINA_GEOJSON_URL).then((r) => r.json()),
      fetch(WORLD_GEOJSON_URL).then((r) => r.json()),
    ]).then(([china, world]: [GeoJSON.GeoJsonObject, GeoJSON.GeoJsonObject]) => {
      if (!mapRef.current) return
      neNamesRef.current = new Set(
        (world as GeoJSON.FeatureCollection).features.map(
          (f) => (f.properties as FeatureProps).NAME ?? '',
        ),
      )
      chinaRef.current = L.geoJSON(china, {
        style: chinaStyle,
        interactive: false,
      }).addTo(map)
      worldRef.current = L.geoJSON(world, {
        style: worldStyle,
        interactive: false,
      }).addTo(map)
      redraw()
    })

    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      chinaRef.current = null
      worldRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw fill + markers whenever the data or toggle changes.
  useEffect(redraw, [cities, visitedProvinces, visitedCountries, showFill])

  function chinaStyle(feature?: GeoJSON.Feature): L.PathOptions {
    const s = stateRef.current
    const prov = snapProvince((feature?.properties as FeatureProps | undefined)?.name)
    const on = s.showFill && prov != null && s.visitedProvinces.includes(prov)
    return on
      ? { fillColor: FILL, fillOpacity: 0.45, color: FILL, weight: 1, opacity: 0.7 }
      : { fillOpacity: 0, opacity: 0, weight: 0 }
  }

  function worldStyle(feature?: GeoJSON.Feature): L.PathOptions {
    const s = stateRef.current
    const resolved = new Set(
      s.visitedCountries
        .map((c) => resolveCountryName(c, neNamesRef.current))
        .filter((n): n is string => n != null),
    )
    const name = (feature?.properties as FeatureProps | undefined)?.NAME ?? ''
    const on = s.showFill && resolved.has(name)
    return on
      ? { fillColor: FILL, fillOpacity: 0.4, color: FILL, weight: 1, opacity: 0.6 }
      : { fillOpacity: 0, opacity: 0, weight: 0 }
  }

  function redraw() {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster) return
    const s = stateRef.current

    chinaRef.current?.setStyle(chinaStyle)
    worldRef.current?.setStyle(worldStyle)

    cluster.clearLayers()
    for (const c of s.cities) {
      const marker = L.marker([c.lat, c.lng], {
        icon: dotIcon(c.anyVisited),
        title: c.city,
      })
      marker.on('click', () => stateRef.current.onSelectCity(c))
      cluster.addLayer(marker)
    }

    if (s.cities.length > 0) {
      const bounds = L.latLngBounds(
        s.cities.map((c) => [c.lat, c.lng] as [number, number]),
      )
      map.fitBounds(bounds.pad(0.2), { maxZoom: 6 })
    }
  }

  return <div ref={elRef} className="h-full w-full" />
}
