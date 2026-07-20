import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconFeather } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { useLiteratureFavorites } from '../hooks/useLiteratureFavorites'
import { loadIndex, loadMeta } from '../data/literature'
import {
  applyPoemView,
  DEFAULT_POEM_CRITERIA,
  sortPoems,
  type PoemCriteria,
  type LiteratureType,
  type PoemSortField,
  type TypeKind,
} from '../lib/literature'
import { routes } from '../constants/routes'
import { ListSearchFilterPanel, ResultCount } from '../components/ListSearchFilterPanel'
import { Toggle } from '../components/Toggle'
import { EmptyState } from '../components/EmptyState'
import { ListRow } from '../components/ListRow'
import { DynastyChip } from '../components/DynastyChip'
import { FilterPill } from '../components/FilterPill'

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
const SORT_OPTIONS: { value: PoemSortField; label: string }[] = [
  { value: 'dynasty', label: '朝代' },
  { value: 'author', label: '作者' },
  { value: 'title', label: '標題' },
]
// Cap the initial paint so a multi-thousand-poem result doesn't render all at once.
const PAGE = 60

/**
 * Literature — Home (poem list). Client-side search (Traditional⇄Simplified via `foldZh`) + a
 * collapsible filter panel (朝代 single-select · 主題/時令/選集 multi-select · Favorites Only) over the
 * static corpus index. Tapping a card opens the poem; the heart toggles a (Supabase) favourite.
 */
export function LiteraturePoems() {
  const navigate = useNavigate()
  const { favoriteIds, toggle } = useLiteratureFavorites()

  const indexFn = useCallback(() => loadIndex(), [])
  const metaFn = useCallback(() => loadMeta(), [])
  const { data: index, loading: indexLoading, error: indexError } = useAsync(indexFn)
  const { data: meta } = useAsync(metaFn)

  const [criteria, setCriteria] = useSessionState<PoemCriteria>(
    'wellworth:literature-home',
    DEFAULT_POEM_CRITERIA,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const setCrit = (patch: Partial<PoemCriteria>) => {
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

  const view = useMemo(() => {
    const filtered = applyPoemView(index ?? [], criteria, { typesById, favoriteIds })
    return sortPoems(
      filtered,
      criteria.sortField,
      criteria.sortDir,
      meta?.dynasties ?? [],
    )
  }, [index, criteria, typesById, favoriteIds, meta])

  function toggleType(id: number) {
    setCrit({
      typeIds: criteria.typeIds.includes(id)
        ? criteria.typeIds.filter((t) => t !== id)
        : [...criteria.typeIds, id],
    })
  }
  function clearFilters() {
    setCriteria(() => ({
      ...DEFAULT_POEM_CRITERIA,
      //query: c.query,
      //sortField: c.sortField,
      //sortDir: c.sortDir,
    }))
    setLimit(PAGE)
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <ListSearchFilterPanel
        sticky
        query={criteria.query}
        onQueryChange={(q) => setCrit({ query: q })}
        placeholder="搜尋詩詞、作者"
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        sortField={criteria.sortField}
        sortOptions={SORT_OPTIONS}
        onSortFieldChange={(f) => setCrit({ sortField: f })}
        sortDir={criteria.sortDir}
        onToggleSortDir={() =>
          setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
        }
        onClearFilters={clearFilters}
        hasActiveFilters={
          JSON.stringify(criteria) !== JSON.stringify(DEFAULT_POEM_CRITERIA)
        }
        extra={
          <span className="flex items-center gap-1.5">
            <span className="text-caption text-text-secondary">只看收藏</span>
            <Toggle
              checked={criteria.favoritesOnly}
              onChange={(v) => setCrit({ favoritesOnly: v })}
              label="只看收藏"
            />
          </span>
        }
        filters={
          <>
            {meta && meta.dynasties.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-caption text-text-secondary">朝代</span>
                <div className="flex flex-wrap gap-1.5">
                  {meta.dynasties.map((d) => (
                    <FilterPill
                      key={d}
                      label={d}
                      selected={criteria.dynasty === d}
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
                      <FilterPill
                        key={t.id}
                        label={t.name}
                        selected={criteria.typeIds.includes(t.id)}
                        onClick={() => toggleType(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        }
        loading={indexLoading}
        loadingText="載入中…"
        error={indexError}
        data={index}
        errorText="無法載入詩詞庫（請確認已產生 public/literature 資料）。"
        emptyState={<EmptyState title="沒有符合的詩詞" Icon={IconFeather} />}
      >
        {() =>
          view.length === 0 ? (
            <EmptyState title="沒有符合的詩詞" Icon={IconFeather} />
          ) : (
            <>
              <ResultCount count={view.length} />
              <div className="flex flex-col gap-2">
                {view.slice(0, limit).map((p) => (
                  <ListRow
                    key={p.id}
                    isFavorite={favoriteIds.has(p.id)}
                    onToggleFavorite={() => toggle(p.id)}
                    onClick={() => navigate(routes.literature.poem(String(p.id)))}
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-body font-medium text-text-primary">
                        {p.title}
                      </span>
                      <span className="text-caption text-text-secondary">{p.writer}</span>
                      {p.dynasty && <DynastyChip dynasty={p.dynasty} />}
                    </span>
                    <p className="mt-1 line-clamp-1 text-caption text-text-secondary">
                      {p.excerpt}
                    </p>
                  </ListRow>
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
          )
        }
      </ListSearchFilterPanel>
    </div>
  )
}
