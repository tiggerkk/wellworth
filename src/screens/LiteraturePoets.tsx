import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { IconUsers } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { loadMeta } from '../data/literature'
import { groupWritersByDynasty } from '../lib/literature'
import { routes } from '../constants/routes'
import { EmptyState } from '../components/EmptyState'
import { FilterPill } from '../components/FilterPill'

/** Literature — Poets. Writers grouped by dynasty as tappable pills → poet detail. */
export function LiteraturePoets() {
  const navigate = useNavigate()
  const fn = useCallback(() => loadMeta(), [])
  const { data: meta, loading, error } = useAsync(fn)

  const groups = useMemo(
    () => (meta ? groupWritersByDynasty(meta.writers, meta.dynasties) : []),
    [meta],
  )

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      {loading && <p className="text-body text-text-secondary">載入中…</p>}
      {error && <p className="text-body text-danger">無法載入名家資料。</p>}
      {!loading && !error && groups.length === 0 && (
        <EmptyState title="沒有名家資料" Icon={IconUsers} />
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-3">
          {groups.map((g) => (
            <div key={g.dynasty} className="flex items-start gap-3">
              <span className="w-16 shrink-0 pt-1.5 text-caption text-text-secondary">
                {g.dynasty}
              </span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {g.writers.map((w) => (
                  <FilterPill
                    key={w.id}
                    label={w.name}
                    onClick={() => navigate(routes.literature.poet(String(w.id)))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
