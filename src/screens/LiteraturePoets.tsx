import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { IconUsers } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { loadMeta } from '../data/literature'
import { groupWritersByDynasty } from '../lib/literature'
import { routes } from '../constants/routes'
import { EmptyState } from '../components/EmptyState'

/** Literature — Poets (名家). Writers grouped by dynasty as tappable chips → poet detail. */
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
      <header className="sticky top-0 z-10 -mx-4 flex items-center bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-title font-medium text-text-primary">名家</h1>
      </header>

      {loading && <p className="text-body text-text-secondary">載入中…</p>}
      {error && <p className="text-body text-danger">無法載入名家資料。</p>}
      {!loading && !error && groups.length === 0 && (
        <EmptyState title="沒有名家資料" Icon={IconUsers} />
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-3">
          {groups.map((g) => (
            <div key={g.dynasty} className="flex items-start gap-3">
              <span className="w-16 shrink-0 pt-1 text-caption text-text-secondary">
                {g.dynasty}
              </span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {g.writers.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => navigate(routes.literature.poet(String(w.id)))}
                    className="rounded-pill bg-input px-2.5 py-1 text-label text-text-primary"
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
