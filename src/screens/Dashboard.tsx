import { useCallback, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { listEntriesByRange } from '../data/diary-entry'
import { NutrientReport } from '../components/NutrientReport'
import { RANGES } from '../constants/ranges'
import { todayLocal } from '../lib/date'

export function Dashboard() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [rangeKey, setRangeKey] = useState('7d')
  const [menuOpen, setMenuOpen] = useState(false)

  const option = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0]!
  const { from, to } = option.toRange(todayLocal())

  const fn = useCallback(() => {
    if (!userId) return Promise.resolve([])
    return listEntriesByRange(userId, from, to)
  }, [userId, from, to])
  const { data: entries, loading, error } = useAsync(fn)

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-bg/90 px-4 py-3 backdrop-blur">
        <span className="text-[15px] text-text-secondary">Daily average ·</span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 text-[15px] font-medium text-text-primary"
          >
            {option.label}
            <IconChevronDown size={16} className="text-text-secondary" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute left-0 z-20 mt-1 w-44 overflow-hidden rounded-card border border-border bg-surface text-sm shadow-lg">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => {
                      setRangeKey(r.key)
                      setMenuOpen(false)
                    }}
                    className={`block w-full px-4 py-2.5 text-left active:bg-input/40 ${
                      r.key === rangeKey ? 'text-accent' : 'text-text-primary'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <NutrientReport entries={entries} loading={loading} error={error} />
    </div>
  )
}
