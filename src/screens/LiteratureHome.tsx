import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconFeather } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { useLiteratureFavorites } from '../hooks/useLiteratureFavorites'
import { loadIndex, loadMeta } from '../data/literature'
import {
  applyHomeView,
  DEFAULT_HOME_CRITERIA,
  type HomeCriteria,
  type LiteratureType,
  type TypeKind,
} from '../lib/literature'
import { routes } from '../constants/routes'
import { SearchBar } from '../components/SearchBar'
import { FilterToggleButton } from '../components/FilterToggleButton'
import { FilterPanel } from '../components/FilterPanel'
import { Toggle } from '../components/Toggle'
import { EmptyState } from '../components/EmptyState'
import { ResultCount } from '../components/ResultCount'
import { PoemCard } from '../components/PoemCard'

const KIND_LABEL: Record<Exclude<TypeKind, 'other'>, string> = {
  theme: '主題',
  season: '時令',
  anthology: '選集',
  style: '風格',
}
const FILTER_KINDS: Exclude<TypeKind, 'other'>[] = [
  'theme',
  'season',
  'anthology',
  'style',
]
// Cap the initial paint so a multi-thousand-poem result doesn't render all at once.
const PAGE = 60

function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-pill px-2.5 py-1 text-label ${
        active ? 'bg-accent text-bg' : 'bg-input text-text-secondary'
      }`}
    >
      {label}
    </button>
  )
}

/**
 * Literature — Home (poem list). Client-side search (Traditional⇄Simplified via `foldZh`) + a
 * collapsible filter panel (朝代 single-select · 主題/時令/選集 multi-select · Favorites Only) over the
 * static corpus index. Tapping a card opens the poem; the heart toggles a (Supabase) favourite.
 */
export function LiteratureHome() {
  const navigate = useNavigate()
  const { favoriteIds, toggle } = useLiteratureFavorites()

  const indexFn = useCallback(() => loadIndex(), [])
  const metaFn = useCallback(() => loadMeta(), [])
  const { data: index, loading: indexLoading, error: indexError } = useAsync(indexFn)
  const { data: meta } = useAsync(metaFn)

  const [criteria, setCriteria] = useSessionState<HomeCriteria>(
    'wellworth:literature-home',
    DEFAULT_HOME_CRITERIA,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const setCrit = (patch: Partial<HomeCriteria>) => {
    setCriteria((c) => ({ ...c, ...patch }))
    setLimit(PAGE)
  }

  const typesById = useMemo(
    () => new Map<number, LiteratureType>((meta?.types ?? []).map((t) => [t.id, t])),
    [meta],
  )
  const typesByKind = useMemo(() => {
    const groups = new Map<TypeKind, LiteratureType[]>()
    for (const t of meta?.types ?? []) {
      const arr = groups.get(t.kind) ?? []
      arr.push(t)
      groups.set(t.kind, arr)
    }
    for (const arr of groups.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder)
    return groups
  }, [meta])

  const view = useMemo(
    () => applyHomeView(index ?? [], criteria, { typesById, favoriteIds }),
    [index, criteria, typesById, favoriteIds],
  )

  const activeFilters =
    !!criteria.dynasty || criteria.typeIds.length > 0 || criteria.favoritesOnly

  function toggleType(id: number) {
    setCrit({
      typeIds: criteria.typeIds.includes(id)
        ? criteria.typeIds.filter((t) => t !== id)
        : [...criteria.typeIds, id],
    })
  }
  function clearFilters() {
    setCriteria((c) => ({ ...DEFAULT_HOME_CRITERIA, query: c.query }))
    setLimit(PAGE)
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <SearchBar
            value={criteria.query}
            onChange={(q) => setCrit({ query: q })}
            placeholder="搜尋詩詞、作者…"
            className="min-w-0 flex-1"
          />
          <FilterToggleButton
            active={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          />
        </div>
      </div>

      {filtersOpen && (
        <FilterPanel>
          {meta && meta.dynasties.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">朝代</span>
              <div className="flex flex-wrap gap-1.5">
                {meta.dynasties.map((d) => (
                  <Pill
                    key={d}
                    label={d}
                    active={criteria.dynasty === d}
                    onClick={() =>
                      setCrit({ dynasty: criteria.dynasty === d ? null : d })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {FILTER_KINDS.map((kind) => {
            const list = typesByKind.get(kind)
            if (!list || list.length === 0) return null
            return (
              <div key={kind} className="flex flex-col gap-1.5">
                <span className="text-caption text-text-secondary">
                  {KIND_LABEL[kind]}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((t) => (
                    <Pill
                      key={t.id}
                      label={t.name}
                      active={criteria.typeIds.includes(t.id)}
                      onClick={() => toggleType(t.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <Toggle
                checked={criteria.favoritesOnly}
                onChange={(v) => setCrit({ favoritesOnly: v })}
                label="只看收藏"
              />
              <span className="text-text-secondary">只看收藏</span>
            </label>
            {activeFilters && (
              <button onClick={clearFilters} className="text-accent">
                清除篩選
              </button>
            )}
          </div>
        </FilterPanel>
      )}

      {indexLoading && <p className="text-body text-text-secondary">載入中…</p>}
      {indexError && (
        <p className="text-body text-danger">
          無法載入詩詞庫（請確認已產生 public/literature 資料）。
        </p>
      )}
      {!indexLoading && !indexError && view.length === 0 && (
        <EmptyState title="沒有符合的詩詞" Icon={IconFeather} />
      )}

      {!indexLoading && !indexError && view.length > 0 && (
        <>
          <ResultCount count={view.length} />
          <div className="flex flex-col gap-2">
            {view.slice(0, limit).map((p) => (
              <PoemCard
                key={p.id}
                entry={p}
                isFavorite={favoriteIds.has(p.id)}
                onOpen={() => navigate(routes.literature.poem(String(p.id)))}
                onToggleFavorite={() => toggle(p.id)}
              />
            ))}
          </div>
          {view.length > limit && (
            <button
              onClick={() => setLimit((n) => n + PAGE)}
              className="mx-auto mt-1 rounded-pill bg-input px-4 py-2 text-body text-text-secondary"
            >
              載入更多（{view.length - limit}）
            </button>
          )}
        </>
      )}
    </div>
  )
}
