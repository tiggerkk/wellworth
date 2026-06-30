import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { IconHeart } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useLiteratureFavorites } from '../hooks/useLiteratureFavorites'
import { loadIndex } from '../data/literature'
import { routes } from '../constants/routes'
import { EmptyState } from '../components/EmptyState'
import { ResultCount } from '../components/ResultCount'
import { PoemCard } from '../components/PoemCard'

/** Literature — Favorites (收藏). The user's favourited poems, drawn from the static index. */
export function LiteratureFavorites() {
  const navigate = useNavigate()
  const { favoriteIds, toggle, loading: favLoading } = useLiteratureFavorites()
  const indexFn = useCallback(() => loadIndex(), [])
  const { data: index, loading: indexLoading, error } = useAsync(indexFn)

  const favorites = useMemo(
    () => (index ?? []).filter((p) => favoriteIds.has(p.id)),
    [index, favoriteIds],
  )

  const loading = indexLoading || favLoading

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-title font-medium text-text-primary">收藏</h1>
      </header>

      {loading && <p className="text-body text-text-secondary">載入中…</p>}
      {error && <p className="text-body text-danger">無法載入詩詞庫。</p>}
      {!loading && !error && favorites.length === 0 && (
        <EmptyState title="尚未收藏任何詩詞" Icon={IconHeart} />
      )}

      {!loading && !error && favorites.length > 0 && (
        <>
          <ResultCount count={favorites.length} />
          <div className="flex flex-col gap-2">
            {favorites.map((p) => (
              <PoemCard
                key={p.id}
                entry={p}
                isFavorite
                onOpen={() => navigate(routes.literature.poem(String(p.id)))}
                onToggleFavorite={() => toggle(p.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
