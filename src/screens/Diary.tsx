import { useCallback, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconDots } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { copyEntriesToDay, deleteEntry, listEntriesByDay } from '../data/diary-entry'
import { addDays, formatDayLabel, todayLocal, type IsoDate } from '../lib/date'
import { bumpDiary, useDiaryVersion } from '../lib/diary-refresh'
import { computeTargets } from '../lib/targets'
import {
  asNutrientMap,
  deriveNetCarbs,
  isOverUpperLimit,
  sumNutrients,
} from '../lib/nutrients'
import { DIARY_GROUPS, type GroupName } from '../constants/groups'
import { Calendar } from '../components/Calendar'
import { GroupHeader } from '../components/GroupHeader'
import { NutrientBar } from '../components/NutrientBar'
import { SwipeRow } from '../components/SwipeRow'
import { ListRow } from '../components/ListRow'

export function Diary() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [day, setDay] = useState<IsoDate>(todayLocal())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copiedDay, setCopiedDay] = useState<IsoDate | null>(null)
  const [expanded, setExpanded] = useState<Partial<Record<GroupName, boolean>>>({})

  const openSheet = useSheetNavigate()
  const { data: profile } = useProfile()
  const { byKey } = useNutrientReference()

  const diaryVersion = useDiaryVersion()
  const entriesFn = useCallback(() => {
    if (!userId) return Promise.resolve([])
    return listEntriesByDay(userId, day)
    // diaryVersion is a refetch signal from sheet mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, day, diaryVersion])
  const { data: entries, loading, error } = useAsync(entriesFn)

  const targets = profile ? computeTargets(profile) : null
  const totals = deriveNetCarbs(
    sumNutrients((entries ?? []).map((e) => asNutrientMap(e.nutrients))),
  )

  async function handleDelete(id: string) {
    await deleteEntry(id)
    bumpDiary()
  }

  async function copyFrom(from: IsoDate, to: IsoDate) {
    if (!userId) return
    setMenuOpen(false)
    await copyEntriesToDay(userId, from, to)
    if (to === day) bumpDiary()
    else setDay(to)
  }

  return (
    <div className="pb-4">
      {/* Day header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-bg/90 px-3 py-3 backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDay(addDays(day, -1))}
            aria-label="Previous day"
            className="p-1 text-text-secondary"
          >
            <IconChevronLeft size={22} />
          </button>
          <button
            onClick={() => setCalendarOpen(true)}
            className="min-w-28 text-center text-[15px] font-medium text-text-primary"
          >
            {formatDayLabel(day)}
          </button>
          <button
            onClick={() => setDay(addDays(day, 1))}
            aria-label="Next day"
            className="p-1 text-text-secondary"
          >
            <IconChevronRight size={22} />
          </button>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Day options"
            className="p-1 text-text-secondary"
          >
            <IconDots size={20} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-card border border-border bg-surface text-sm shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    openSheet(`/report/${day}`)
                  }}
                  className="block w-full border-b border-border px-4 py-2.5 text-left text-text-primary active:bg-input/40"
                >
                  View Daily Report
                </button>
                {copiedDay && (
                  <button
                    onClick={() => copyFrom(copiedDay, todayLocal())}
                    className="block w-full px-4 py-2.5 text-left text-text-primary active:bg-input/40"
                  >
                    Copy to Today
                  </button>
                )}
                <button
                  onClick={() => {
                    setCopiedDay(day)
                    setMenuOpen(false)
                  }}
                  className="block w-full px-4 py-2.5 text-left text-text-primary active:bg-input/40"
                >
                  Copy Current Day
                </button>
                <button
                  onClick={() => copyFrom(addDays(day, -1), day)}
                  className="block w-full px-4 py-2.5 text-left text-text-primary active:bg-input/40"
                >
                  Copy Previous Day
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Highlighted nutrients */}
      {profile && profile.highlighted_nutrients.length > 0 && (
        <section className="px-4 pb-2 pt-1">
          <div className="grid grid-cols-2 gap-x-4">
            {profile.highlighted_nutrients.map((key) => {
              const ref = byKey.get(key)
              const dri = targets?.dri[key]
              const value = totals[key] ?? 0
              return (
                <NutrientBar
                  key={key}
                  label={ref?.display_name ?? key}
                  value={value}
                  target={dri?.target ?? null}
                  unit={ref?.unit ?? ''}
                  over={dri ? isOverUpperLimit(value, dri) : false}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* States */}
      {loading && <p className="px-4 py-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 py-6 text-sm text-danger">
          Couldn’t load this day. Pull to retry.
        </p>
      )}

      {/* Groups */}
      {!loading && !error && (
        <div className="flex flex-col gap-3 px-4">
          {DIARY_GROUPS.map((group) => {
            const groupEntries = (entries ?? []).filter((e) => e.group_name === group.key)
            const subtotal = groupEntries.reduce(
              (sum, e) => sum + (e.energy_kcal ?? 0),
              0,
            )
            const isOpen = expanded[group.key] ?? false
            return (
              <div
                key={group.key}
                className="overflow-hidden rounded-card border border-border bg-surface"
              >
                <GroupHeader
                  title={group.label}
                  kcal={subtotal}
                  expanded={isOpen}
                  onAdd={() =>
                    openSheet(
                      group.kind === 'activity'
                        ? '/add-activity'
                        : `/add-food?group=${group.key}`,
                    )
                  }
                  onToggle={() =>
                    setExpanded((prev) => ({ ...prev, [group.key]: !isOpen }))
                  }
                />
                {isOpen &&
                  (groupEntries.length === 0 ? (
                    <p className="border-t border-border px-4 py-3 text-xs text-text-tertiary">
                      Nothing logged.
                    </p>
                  ) : (
                    <div className="border-t border-border">
                      {groupEntries.map((e) => (
                        <SwipeRow key={e.id} onDelete={() => handleDelete(e.id)}>
                          <ListRow
                            title={e.label}
                            subtitle={
                              e.duration_min ? `${e.duration_min} min` : undefined
                            }
                            trailing={`${Math.round(e.energy_kcal ?? 0)} kcal`}
                          />
                        </SwipeRow>
                      ))}
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {calendarOpen && (
        <Calendar
          day={day}
          onSelect={(d) => {
            setDay(d)
            setCalendarOpen(false)
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  )
}
