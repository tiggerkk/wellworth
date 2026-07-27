import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconNotebook } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { bumpJournal, useJournalVersion } from '../lib/journal-refresh'
import { deleteJournalEntry, listJournalEntries } from '../data/journal'
import {
  applyJournalView,
  DEFAULT_JOURNAL_CRITERIA,
  rankedJournalTags,
  type JournalCriteria,
  type JournalRow,
  type JournalSortField,
} from '../lib/journal'
import { foldZh } from '../lib/zh-fold'
import {
  formatDayOfMonth,
  formatMonthLabel,
  formatWeekdayShort,
  todayLocal,
  type IsoDate,
} from '../lib/date'
import { routes } from '../constants/routes'
import { ListRow } from '../components/ListRow'
import { EmptyState } from '../components/EmptyState'
import { ListSearchFilterPanel, ResultCount } from '../components/ListSearchFilterPanel'
import { ListFab } from '../components/ListFab'
import { FilterPill } from '../components/FilterPill'
import { LabelChip } from '../components/LabelChip'
import { SelectMenu } from '../components/SelectMenu'
import { DateRangeRow } from '../components/DateRangeRow'
import { Calendar } from '../components/Calendar'
import { useProfile } from '../hooks/useProfile'
import { effectiveMoods, moodColor, moodLabel } from '../lib/journal-moods'

const SORT_OPTIONS: { value: JournalSortField; label: string }[] = [
  { value: 'date', label: 'Date' },
]
// The tag facet shows this many most-used tags by default; above it, a search box finds the rest.
const TOP_TAGS = 10

type DateBound = 'dateFrom' | 'dateTo'

/**
 * Journal — listing screen. Folded into the Quotes module (own table, own tag vocabulary). Rows
 * are grouped under a centered "Month Year" heading, newest month first — mirrors QuotesLibrary's
 * search/filter/sort chrome (`ListSearchFilterPanel`, `ListRow`, tag facet) but sorts by day only.
 */
export function JournalLibrary() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useJournalVersion()
  const { data: profile } = useProfile()
  const moods = useMemo(
    () => effectiveMoods(profile?.journal_moods),
    [profile?.journal_moods],
  )
  const moodOptions = useMemo(
    () => [
      { value: 'all', label: 'Any Mood' },
      ...moods.map((m) => ({ value: m.key, label: m.label })),
    ],
    [moods],
  )

  const [criteria, setCriteria] = useSessionState<JournalCriteria>(
    'wellworth:journal-library',
    DEFAULT_JOURNAL_CRITERIA,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [whichDate, setWhichDate] = useState<DateBound | null>(null)
  const setCrit = (patch: Partial<JournalCriteria>) =>
    setCriteria((c) => ({ ...c, ...patch }))

  const fn = useCallback(() => {
    void version // refetch after a create/edit/delete (bumpJournal)
    if (!userId) return Promise.resolve([])
    return listJournalEntries(userId)
  }, [userId, version])
  const {
    data: entries,
    loading,
    error,
  } = useAsync(fn, undefined, userId ? { key: `journal:${userId}`, version } : undefined)

  // Optimistic delete: drop the row locally so it disappears instantly, instead of waiting for a
  // `bumpJournal()` → full-listing refetch. Override resets when a real fetch lands.
  const [override, setOverride] = useState<typeof entries>(undefined)
  const [syncedEntries, setSyncedEntries] = useState(entries)
  if (syncedEntries !== entries) {
    setSyncedEntries(entries)
    setOverride(undefined)
  }

  async function remove(id: string) {
    setOverride((prev) => (prev ?? entries ?? []).filter((e) => e.id !== id))
    try {
      await deleteJournalEntry(id)
    } catch {
      bumpJournal() // resync from server on a failed delete
    }
  }

  function clearFilters() {
    setCriteria(() => ({ ...DEFAULT_JOURNAL_CRITERIA }))
    setTagQuery('')
  }
  function toggleTag(tag: string) {
    setCriteria((c) => ({
      ...c,
      tags: c.tags.includes(tag) ? c.tags.filter((t) => t !== tag) : [...c.tags, tag],
    }))
  }
  function setBound(which: DateBound, d: IsoDate | null) {
    setCrit({ [which]: d })
  }

  const all = useMemo(() => override ?? entries ?? [], [override, entries])
  // Memoized: applyJournalView filters/sorts/searches the whole list, so without this it reran
  // on every render instead of only when the list or criteria change.
  const view = useMemo(() => applyJournalView(all, criteria), [all, criteria])
  // Tags ranked by entry count (most-used first). By default the facet shows the top N; once
  // there are more, a search box narrows the FULL list. Selected tags always stay visible.
  const ranked = useMemo(() => rankedJournalTags(all), [all])
  const showTagSearch = ranked.length > TOP_TAGS
  const tagFilter = foldZh(tagQuery.trim())
  const pool = tagFilter
    ? ranked.filter((r) => foldZh(r.tag).includes(tagFilter)).map((r) => r.tag)
    : ranked.slice(0, TOP_TAGS).map((r) => r.tag)
  const displayTags = [
    ...criteria.tags.filter((t) => !tagFilter || foldZh(t).includes(tagFilter)),
    ...pool.filter((t) => !criteria.tags.includes(t)),
  ]

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <ListSearchFilterPanel
        sticky
        query={criteria.query}
        onQueryChange={(q) => setCrit({ query: q })}
        placeholder="Search journal entry, tag"
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
          JSON.stringify(criteria) !== JSON.stringify(DEFAULT_JOURNAL_CRITERIA)
        }
        filters={
          <>
            <DateRangeRow
              label="Date"
              from={criteria.dateFrom}
              to={criteria.dateTo}
              onPickFrom={() => setWhichDate('dateFrom')}
              onPickTo={() => setWhichDate('dateTo')}
              onClearFrom={() => setBound('dateFrom', null)}
              onClearTo={() => setBound('dateTo', null)}
            />

            <div className={showTagSearch ? 'grid grid-cols-2 gap-3' : ''}>
              <SelectMenu
                value={criteria.mood}
                options={moodOptions}
                onChange={(v) => setCrit({ mood: v })}
                ariaLabel="Mood"
              />
              {showTagSearch && (
                <input
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Filter tags…"
                  aria-label="Filter tags"
                  className="field-control w-full"
                />
              )}
            </div>

            {ranked.length > 0 && (
              <div className="flex max-h-32 flex-wrap items-center gap-1.5 overflow-y-auto">
                {displayTags.map((tag) => (
                  <FilterPill
                    key={tag}
                    label={tag}
                    selected={criteria.tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  />
                ))}
                {displayTags.length === 0 && (
                  <span className="text-text-tertiary">No tags match.</span>
                )}
                {showTagSearch && !tagFilter && (
                  <span className="text-text-tertiary">· top {TOP_TAGS} by use</span>
                )}
              </div>
            )}
          </>
        }
        loading={loading}
        error={error}
        data={override ?? entries}
        errorText="Couldn’t load your journal."
        emptyState={
          <EmptyState
            title="No journal entries yet"
            actionLabel="New Journal"
            to={routes.quotes.journalEntry}
            Icon={IconNotebook}
          />
        }
      >
        {() => {
          if (view.length === 0) {
            return (
              <p className="py-16 text-center text-body text-text-secondary">
                No journal entries match.
              </p>
            )
          }
          const groups = groupByMonth(view)
          return (
            <>
              <ResultCount count={view.length} />
              <div className="flex flex-col gap-4">
                {groups.map(([month, monthEntries]) => (
                  <div key={month} className="flex flex-col gap-2">
                    <p className="text-center text-caption font-medium text-text-secondary">
                      {formatMonthLabel(month)}
                    </p>
                    <div className="flex flex-col gap-2">
                      {monthEntries.map((entry) => {
                        const color = moodColor(moods, entry.mood)
                        return (
                          <ListRow
                            key={entry.id}
                            onDelete={() => void remove(entry.id)}
                            onClick={() => navigate(routes.quotes.journalEdit(entry.id))}
                            color={color}
                            leading={
                              <div className="flex flex-col items-center gap-1">
                                <DateBadge day={entry.day} />
                                <LabelChip
                                  label={moodLabel(moods, entry.mood)}
                                  color={color}
                                  className="text-[10px] px-1.5 py-0"
                                />
                              </div>
                            }
                          >
                            <span className="line-clamp-3 block text-body text-text-primary">
                              {entry.journal_entry}
                            </span>
                          </ListRow>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <ListFab
                onClick={() => navigate(routes.quotes.journalEntry)}
                label="New Journal"
              />
            </>
          )
        }}
      </ListSearchFilterPanel>

      {whichDate && (
        <Calendar
          day={
            (whichDate === 'dateFrom' ? criteria.dateFrom : criteria.dateTo) ??
            todayLocal()
          }
          onSelect={(d) => {
            setBound(whichDate, d)
            setWhichDate(null)
          }}
          onClose={() => setWhichDate(null)}
        />
      )}
    </div>
  )
}

/** The row's leading date badge: non-bolded weekday over a bolded day-of-month. */
function DateBadge({ day }: { day: IsoDate }) {
  return (
    <span className="flex w-9 flex-col items-center justify-center rounded-input bg-input py-1.5 text-text-primary">
      <span className="text-[10px] leading-tight text-text-secondary">
        {formatWeekdayShort(day)}
      </span>
      <span className="text-body font-bold leading-tight">{formatDayOfMonth(day)}</span>
    </span>
  )
}

/** Group entries (already sorted by the view) into contiguous month buckets, preserving order. */
function groupByMonth(entries: JournalRow[]): [IsoDate, JournalRow[]][] {
  const groups: [IsoDate, JournalRow[]][] = []
  for (const entry of entries) {
    const monthKey = `${entry.day.slice(0, 7)}-01`
    const last = groups[groups.length - 1]
    if (last && last[0] === monthKey) last[1].push(entry)
    else groups.push([monthKey, [entry]])
  }
  return groups
}
