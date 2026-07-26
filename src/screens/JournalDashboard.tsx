import { Suspense, useCallback, useMemo, useState } from 'react'
import { IconChevronDown, IconNotebook } from '@tabler/icons-react'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useJournalVersion } from '../lib/journal-refresh'
import { listJournalDays, listJournalMoodCountsByRange } from '../data/journal'
import { effectiveMoods, moodLabel } from '../lib/journal-moods'
import { computeJournalStats, topMood } from '../lib/journal-stats'
import {
  JOURNAL_MOOD_POSITIONS,
  JOURNAL_RANGES,
  JOURNAL_RANGE_DEFAULT,
} from '../constants/journal'
import { KpiTile } from '../components/KpiTile'
import { EmptyState } from '../components/EmptyState'
import { routes } from '../constants/routes'
import { todayLocal } from '../lib/date'
import type { CircumplexPoint } from '../components/JournalCircumplexChart'

// Lazy so recharts is fetched only when the dashboard renders (own chunk).
const JournalCircumplexChart = lazyWithReload(() =>
  import('../components/JournalCircumplexChart').then((m) => ({
    default: m.JournalCircumplexChart,
  })),
)

// Wide enough to cover any real journal history without a second "all time" query variant.
const EARLIEST_DAY = '1970-01-01'

export function JournalDashboard() {
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useJournalVersion()
  const { data: profile } = useProfile()
  const moods = effectiveMoods(profile?.journal_moods)

  const [rangeKey, setRangeKey] = useState(JOURNAL_RANGE_DEFAULT)
  const [menuOpen, setMenuOpen] = useState(false)
  const option = JOURNAL_RANGES.find((r) => r.key === rangeKey) ?? JOURNAL_RANGES[0]!
  const { from, to } = option.toRange(todayLocal())

  // All-time days (Total Entries / streaks / this month) — independent of the selected interval.
  const daysFn = useCallback(() => {
    void version
    if (!userId) return Promise.resolve<string[]>([])
    return listJournalDays(userId, EARLIEST_DAY, todayLocal())
  }, [userId, version])
  const { data: allDays, loading: daysLoading, error: daysError } = useAsync(daysFn)

  // Per-mood counts within the selected interval — the circumplex chart's source.
  const countsFn = useCallback(() => {
    void version
    if (!userId) return Promise.resolve<Record<string, number>>({})
    return listJournalMoodCountsByRange(userId, from, to)
  }, [userId, version, from, to])
  const {
    data: moodCounts,
    loading: countsLoading,
    error: countsError,
  } = useAsync(countsFn)

  const stats = useMemo(() => computeJournalStats(allDays ?? [], todayLocal()), [allDays])
  const points: CircumplexPoint[] = useMemo(
    () =>
      moods.map((m) => ({
        key: m.key,
        label: m.label,
        color: m.color,
        valence:
          JOURNAL_MOOD_POSITIONS[m.key as keyof typeof JOURNAL_MOOD_POSITIONS]?.valence ??
          0,
        arousal:
          JOURNAL_MOOD_POSITIONS[m.key as keyof typeof JOURNAL_MOOD_POSITIONS]?.arousal ??
          0,
        count: moodCounts?.[m.key] ?? 0,
      })),
    [moods, moodCounts],
  )
  const topMoodKey = useMemo(
    () =>
      topMood(
        moodCounts ?? {},
        moods.map((m) => m.key),
      ),
    [moodCounts, moods],
  )

  const loading = daysLoading || countsLoading
  const error = daysError ?? countsError

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-bg/90 px-4 py-3 backdrop-blur">
        <span className="text-body text-text-secondary">Journal Dashboard ·</span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 text-body font-medium text-text-primary"
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
              <div className="absolute left-0 z-20 mt-1 w-44 overflow-hidden rounded-card border border-border bg-surface text-body shadow-lg">
                {JOURNAL_RANGES.map((r) => (
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

      {!loading && !error && stats.totalEntries === 0 ? (
        <EmptyState
          Icon={IconNotebook}
          title="No journal entries yet"
          actionLabel="New Journal"
          to={routes.quotes.journalEntry}
        />
      ) : error ? (
        <p className="py-16 text-center text-body text-text-secondary">
          Couldn’t load your Journal Dashboard.
        </p>
      ) : loading ? (
        <p className="py-16 text-center text-body text-text-secondary">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <KpiTile value={stats.totalEntries} label="Total Entries" />
            <KpiTile value={stats.currentStreak} suffix="days" label="Current Streak" />
            <KpiTile value={stats.longestStreak} suffix="days" label="Longest Streak" />
            <KpiTile value={stats.entriesThisMonth} label="Entries This Month" />
          </div>

          <div className="rounded-card border border-border bg-surface p-2">
            <p className="px-2 pt-2 text-caption font-medium text-text-secondary">
              Mood Map · {option.label}
            </p>
            {topMoodKey && (
              <p className="px-2 pb-1 text-caption text-text-tertiary">
                Most common: {moodLabel(moods, topMoodKey)}
              </p>
            )}
            <Suspense
              fallback={
                <p className="py-10 text-center text-body text-text-secondary">
                  Loading chart…
                </p>
              }
            >
              <JournalCircumplexChart points={points} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}
