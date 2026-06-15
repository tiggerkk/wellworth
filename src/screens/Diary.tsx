import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconSquare,
  IconSquareCheckFilled,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import {
  cloneEntriesToDay,
  deleteEntriesByDay,
  deleteEntry,
  listEntriesByDay,
} from '../data/diary-entry'
import { listSetsForEntries } from '../data/strength-set'
import { addDays, formatDayLabel, todayLocal, type IsoDate } from '../lib/date'
import { bumpDiary, useDiaryVersion } from '../lib/diary-refresh'
import { setDiaryClipboard, useDiaryClipboard } from '../lib/diary-clipboard'
import { computeTargets } from '../lib/targets'
import {
  asNutrientMap,
  deriveNetCarbs,
  isOverUpperLimit,
  sumNutrients,
} from '../lib/nutrients'
import { DIARY_GROUPS, type GroupName } from '../constants/groups'
import type { Tables } from '../types/database'
import { Calendar } from '../components/Calendar'
import { GroupHeader } from '../components/GroupHeader'
import { NutrientBar } from '../components/NutrientBar'
import { SwipeRow } from '../components/SwipeRow'
import { ListRow } from '../components/ListRow'

export function Diary() {
  const { session } = useAuth()
  const userId = session?.user.id

  // The viewed day lives in the URL (`/?day=YYYY-MM-DD`) rather than component state, so it
  // survives the Diary unmounting/remounting while a sheet (Daily Report, Add Food/Activity)
  // is open over it: navigate(-1) returns to the same entry and restores the day. A clean `/`
  // (no param) means today. `setDay` replaces the entry so day stepping doesn't pile up history.
  const [params, setParams] = useSearchParams()
  const dayParam = params.get('day')
  const day: IsoDate =
    dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : todayLocal()
  const setDay = useCallback(
    (d: IsoDate) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (d === todayLocal()) next.delete('day')
          else next.set('day', d)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const [calendarOpen, setCalendarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState<Partial<Record<GroupName, boolean>>>({})

  // Multi-select: checkboxes on each entry, the selected ids, and the in-app clipboard.
  const [multiSelect, setMultiSelect] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const clipboard = useDiaryClipboard()
  const canPaste = clipboard != null && clipboard.day !== day

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

  // Leaving the day abandons any in-progress selection (its ids belong to the old day).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMultiSelect(false)
    setSelected(new Set())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [day])

  const targets = profile ? computeTargets(profile) : null
  const totals = deriveNetCarbs(
    sumNutrients((entries ?? []).map((e) => asNutrientMap(e.nutrients))),
  )

  async function handleDelete(id: string) {
    await deleteEntry(id)
    bumpDiary()
  }

  function enterMultiSelect() {
    setMenuOpen(false)
    setSelected(new Set())
    // Expand every group so all entries are visible to select.
    setExpanded(Object.fromEntries(DIARY_GROUPS.map((g) => [g.key, true])))
    setMultiSelect(true)
  }

  function exitMultiSelect() {
    setMultiSelect(false)
    setSelected(new Set())
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copySelected() {
    const chosen = (entries ?? []).filter((e) => selected.has(e.id))
    if (chosen.length === 0) return
    setMenuOpen(false)
    // Pull strength_set children for any selected activity entries so Copy carries them.
    const sets = await listSetsForEntries(
      chosen.filter((e) => e.kind === 'activity').map((e) => e.id),
    )
    const setsByEntry: Record<string, Tables<'strength_set'>[]> = {}
    for (const s of sets) (setsByEntry[s.entry_id] ??= []).push(s)
    setDiaryClipboard({ day, entries: chosen, setsByEntry })
    exitMultiSelect()
  }

  async function paste() {
    if (!userId || !clipboard || clipboard.day === day) return
    setMenuOpen(false)
    await cloneEntriesToDay(userId, day, clipboard.entries, clipboard.setsByEntry)
    bumpDiary()
  }

  async function deleteAll() {
    if (!userId) return
    setMenuOpen(false)
    if (
      !window.confirm(
        `Delete all entries for ${formatDayLabel(day)}? This can’t be undone.`,
      )
    ) {
      return
    }
    await deleteEntriesByDay(userId, day)
    bumpDiary()
  }

  const menuItem =
    'block w-full px-4 py-2.5 text-left text-text-primary active:bg-input/40'

  return (
    <div className="pb-4">
      {/* Pinned top pane: day header + highlighted nutrients stay visible while groups scroll. */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur">
        <header className="flex items-center justify-between px-3 py-3">
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
                <div className="absolute right-0 z-20 mt-1 w-56 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface text-sm shadow-lg">
                  {multiSelect ? (
                    <>
                      <button
                        onClick={() => void copySelected()}
                        disabled={selected.size === 0}
                        className={`${menuItem} disabled:text-text-tertiary disabled:active:bg-transparent`}
                      >
                        Copy{selected.size > 0 ? ` (${selected.size})` : ''}
                      </button>
                      <button onClick={exitMultiSelect} className={menuItem}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          openSheet(`/report/${day}`)
                        }}
                        className={menuItem}
                      >
                        View Daily Report
                      </button>
                      <button onClick={enterMultiSelect} className={menuItem}>
                        Multi-Select
                      </button>
                      {canPaste && (
                        <button onClick={() => void paste()} className={menuItem}>
                          Paste
                        </button>
                      )}
                      <button
                        onClick={() => void deleteAll()}
                        className={`${menuItem} text-danger`}
                      >
                        Delete All Diary Entries
                      </button>
                    </>
                  )}
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
      </div>

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
                  Icon={group.Icon}
                  iconClass={group.iconClass}
                  kcal={subtotal}
                  expanded={isOpen}
                  onAdd={() =>
                    openSheet(
                      group.kind === 'activity'
                        ? `/add-activity?day=${day}`
                        : `/add-food?group=${group.key}&day=${day}`,
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
                      {groupEntries.map((e) => {
                        const row = (
                          <ListRow
                            leading={
                              multiSelect ? (
                                selected.has(e.id) ? (
                                  <IconSquareCheckFilled
                                    size={20}
                                    className="text-positive"
                                  />
                                ) : (
                                  <IconSquare size={20} className="text-text-tertiary" />
                                )
                              ) : undefined
                            }
                            title={e.label}
                            subtitle={
                              e.duration_min ? `${e.duration_min} min` : undefined
                            }
                            trailing={`${Math.round(e.energy_kcal ?? 0)} kcal`}
                            onClick={
                              multiSelect
                                ? () => toggleSelect(e.id)
                                : () => {
                                    if (e.kind === 'activity' && e.activity_id)
                                      openSheet(
                                        `/activity/${e.activity_id}?entry=${e.id}&day=${day}`,
                                      )
                                    else if (e.kind === 'food' && e.food_id)
                                      openSheet(
                                        `/food/local/${e.food_id}?entry=${e.id}&group=${e.group_name}&day=${day}`,
                                      )
                                  }
                            }
                          />
                        )
                        return multiSelect ? (
                          <div key={e.id}>{row}</div>
                        ) : (
                          <SwipeRow key={e.id} onDelete={() => handleDelete(e.id)}>
                            {row}
                          </SwipeRow>
                        )
                      })}
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
