import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClipboard,
  IconCopy,
  IconReportAnalytics,
  IconTrash,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import {
  cloneEntriesToDay,
  deleteEntriesByDay,
  deleteEntriesByGroup,
  deleteEntry,
  listEntriesByDay,
  listEntriesByRange,
  reorderEntries,
} from '../data/diary-entry'
import { listSetsForEntries } from '../data/strength-set'
import { addDays, formatDayLabel, todayLocal, type IsoDate } from '../lib/date'
import { bumpDiary, useDiaryVersion } from '../lib/diary-refresh'
import { setDiaryClipboard, useDiaryClipboard } from '../lib/diary-clipboard'
import { showToast } from '../lib/toast'
import { computeTargets } from '../lib/targets'
import {
  asNutrientMap,
  deriveNetCarbs,
  isOverUpperLimit,
  sumNutrients,
} from '../lib/nutrients'
import { DIARY_GROUPS, type DiaryGroup, type GroupName } from '../constants/groups'
import { routes } from '../constants/routes'
import type { Tables } from '../types/database'
import { Calendar, type DayCue } from '../components/Calendar'
import { GroupHeader } from '../components/GroupHeader'
import { IconAction } from '../components/IconAction'
import { NutrientBar } from '../components/NutrientBar'
import { ReorderList } from '../components/ReorderList'

export function Diary() {
  const { session } = useAuth()
  const userId = session?.user.id

  // The viewed day lives in the URL (`/wellness?day=YYYY-MM-DD`) rather than component state, so
  // it survives the Diary unmounting/remounting while a sheet (Daily Report, Add Food/Activity)
  // is open over it: navigate(-1) returns to the same entry and restores the day. A clean
  // `/wellness` (no param) means today. `setDay` replaces so day stepping doesn't pile up history.
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
  // Diary supplies the calendar's food/activity cue dots for the visible month.
  const loadCalendarCues = useCallback(
    async (monthStart: IsoDate, monthEnd: IsoDate): Promise<Map<IsoDate, DayCue>> => {
      const map = new Map<IsoDate, DayCue>()
      if (!userId) return map
      for (const e of await listEntriesByRange(userId, monthStart, monthEnd)) {
        const cur = map.get(e.day) ?? {}
        if (e.kind === 'activity') cur.activity = true
        else cur.food = true
        map.set(e.day, cur)
      }
      return map
    },
    [userId],
  )
  const [expanded, setExpanded] = useState<Partial<Record<GroupName, boolean>>>({})
  // Optimistic per-group order override (drag-to-reorder). Keyed by group; used only while its id
  // set still matches the fetched entries — once an item is added/removed there, it falls back to
  // the fetched (sort_order) order. Survives the reorder's background persist + refetch.
  const [orderOverride, setOrderOverride] = useState<
    Partial<Record<GroupName, string[]>>
  >({})

  const clipboard = useDiaryClipboard()
  const canPaste = clipboard != null

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

  // Default-expand on entry / day change: when a day's entries first settle, open every non-empty
  // group (empty groups stay collapsed). Runs once per day — a `sawLoading` ref ignores the brief
  // render where `day` already changed but `entries`/`loading` are still the previous day's (stale)
  // values, and `autoExpandedDay` stops later same-day refetches (add/delete) from clobbering the
  // user's manual collapses. Paste resets `autoExpandedDay` so its refetch re-expands non-empty groups.
  const sawLoadingForDay = useRef<IsoDate | null>(null)
  const autoExpandedDay = useRef<IsoDate | null>(null)
  useEffect(() => {
    if (loading) {
      sawLoadingForDay.current = day
      return
    }
    if (sawLoadingForDay.current !== day) return // stale window: data not yet for this day
    if (!entries || autoExpandedDay.current === day) return
    setExpanded(
      Object.fromEntries(
        DIARY_GROUPS.map((g) => [g.key, entries.some((e) => e.group_name === g.key)]),
      ),
    )
    autoExpandedDay.current = day
  }, [day, loading, entries])

  const targets = profile ? computeTargets(profile) : null
  const totals = deriveNetCarbs(
    sumNutrients((entries ?? []).map((e) => asNutrientMap(e.nutrients))),
  )

  async function handleDelete(id: string) {
    await deleteEntry(id)
    bumpDiary()
  }

  /** Bundle entries + their strength_set children into a clipboard payload. */
  async function buildClipboard(chosen: Tables<'diary_entry'>[]) {
    const sets = await listSetsForEntries(
      chosen.filter((e) => e.kind === 'activity').map((e) => e.id),
    )
    const setsByEntry: Record<string, Tables<'strength_set'>[]> = {}
    for (const s of sets) (setsByEntry[s.entry_id] ??= []).push(s)
    return { day, entries: chosen, setsByEntry }
  }

  function entriesFor(group: GroupName): Tables<'diary_entry'>[] {
    return (entries ?? []).filter((e) => e.group_name === group)
  }

  // --- Day-level actions (header, top-right) ---

  async function copyDay() {
    const chosen = entries ?? []
    if (chosen.length === 0) return
    setDiaryClipboard(await buildClipboard(chosen))
    showToast(
      `Copied ${formatDayLabel(day)} · ${chosen.length} item${chosen.length === 1 ? '' : 's'}`,
    )
  }

  async function pasteDay() {
    if (!userId || !clipboard) return
    // Day paste keeps each item's original group (no override).
    await cloneEntriesToDay(userId, day, clipboard.entries, clipboard.setsByEntry)
    setDiaryClipboard(null) // one-shot
    autoExpandedDay.current = null // re-expand non-empty groups once the paste refetch settles
    bumpDiary()
  }

  async function deleteDay() {
    if (!userId || (entries ?? []).length === 0) return
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

  // --- Group-level actions (group header) ---

  async function copyGroup(group: DiaryGroup) {
    const chosen = entriesFor(group.key)
    if (chosen.length === 0) return
    setDiaryClipboard(await buildClipboard(chosen))
    showToast(
      `Copied ${group.label} · ${chosen.length} item${chosen.length === 1 ? '' : 's'}`,
    )
  }

  async function pasteGroup(group: DiaryGroup) {
    if (!userId || !clipboard) return
    // Group paste retargets every clipboard item into this group.
    await cloneEntriesToDay(userId, day, clipboard.entries, clipboard.setsByEntry, {
      groupOverride: group.key,
    })
    setDiaryClipboard(null) // one-shot
    autoExpandedDay.current = null // re-expand non-empty groups once the paste refetch settles
    bumpDiary()
  }

  async function deleteGroup(group: DiaryGroup) {
    if (!userId || entriesFor(group.key).length === 0) return
    if (!window.confirm(`Delete all entries in ${group.label}? This can’t be undone.`)) {
      return
    }
    await deleteEntriesByGroup(userId, day, group.key)
    bumpDiary()
  }

  function openEdit(e: Tables<'diary_entry'>) {
    if (e.kind === 'activity' && e.activity_id)
      openSheet(`${routes.wellness.activity(e.activity_id)}?entry=${e.id}&day=${day}`)
    else if (e.kind === 'food' && e.food_id)
      openSheet(
        `${routes.wellness.food('local', e.food_id)}?entry=${e.id}&group=${e.group_name}&day=${day}`,
      )
  }

  /** Apply the optimistic order override for a group when its id set still matches the fetched rows. */
  function orderedEntries(group: GroupName, groupEntries: Tables<'diary_entry'>[]) {
    const ov = orderOverride[group]
    if (
      ov &&
      ov.length === groupEntries.length &&
      groupEntries.every((e) => ov.includes(e.id))
    ) {
      const byId = new Map(groupEntries.map((e) => [e.id, e]))
      return ov.map((id) => byId.get(id)!)
    }
    return groupEntries
  }

  const dayCount = (entries ?? []).length

  return (
    <div className="pb-4">
      {/* Pinned top pane: day header + highlighted nutrients stay visible while groups scroll. */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur">
        <header className="flex items-center px-3 py-3">
          {/* Top-left: Daily Report */}
          <IconAction
            Icon={IconReportAnalytics}
            label="Daily report"
            onClick={() => openSheet(routes.wellness.report(day))}
          />
          {/* Center: day nav */}
          <div className="flex flex-1 items-center justify-center gap-1">
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
          {/* Top-right: Delete · Copy · Paste for the whole day */}
          <div className="flex items-center gap-1">
            <IconAction
              Icon={IconTrash}
              label="Delete all entries today"
              onClick={() => void deleteDay()}
              disabled={dayCount === 0}
            />
            <IconAction
              Icon={IconCopy}
              label="Copy all entries today"
              onClick={() => void copyDay()}
              disabled={dayCount === 0}
            />
            <IconAction
              Icon={IconClipboard}
              label="Paste into today"
              onClick={() => void pasteDay()}
              disabled={!canPaste}
              tone="positive"
            />
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
            const groupEntries = orderedEntries(group.key, entriesFor(group.key))
            const subtotal = groupEntries.reduce(
              (sum, e) => sum + (e.energy_kcal ?? 0),
              0,
            )
            const isOpen = expanded[group.key] ?? false
            const byId = new Map(groupEntries.map((e) => [e.id, e]))
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
                  count={groupEntries.length}
                  canPaste={canPaste}
                  expanded={isOpen}
                  onAdd={() =>
                    openSheet(
                      group.kind === 'activity'
                        ? `${routes.wellness.addActivity}?day=${day}`
                        : `${routes.wellness.addFood}?group=${group.key}&day=${day}`,
                    )
                  }
                  onToggle={() =>
                    setExpanded((prev) => ({ ...prev, [group.key]: !isOpen }))
                  }
                  onDelete={() => void deleteGroup(group)}
                  onCopy={() => void copyGroup(group)}
                  onPaste={() => void pasteGroup(group)}
                />
                {isOpen &&
                  (groupEntries.length === 0 ? (
                    <p className="border-t border-border px-4 py-3 text-xs text-text-tertiary">
                      Nothing logged.
                    </p>
                  ) : (
                    <ReorderList
                      ids={groupEntries.map((e) => e.id)}
                      containerClassName="border-t border-border divide-y divide-border"
                      onReorder={(nextIds) => {
                        setOrderOverride((prev) => ({ ...prev, [group.key]: nextIds }))
                        void reorderEntries(nextIds).catch(() => bumpDiary())
                      }}
                      onDelete={(id) => void handleDelete(id)}
                      handleLabel={() => `Drag to reorder in ${group.label}`}
                      renderLabel={(id) => {
                        const e = byId.get(id)
                        if (!e) return null
                        return (
                          <button
                            onClick={() => openEdit(e)}
                            className="block w-full truncate text-left"
                          >
                            {e.label}
                            {e.duration_min ? ` · ${e.duration_min} min` : ''}
                          </button>
                        )
                      }}
                      renderTrailing={(id) => (
                        <span className="text-sm text-text-muted">
                          {Math.round(byId.get(id)?.energy_kcal ?? 0)} kcal
                        </span>
                      )}
                    />
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {calendarOpen && (
        <Calendar
          day={day}
          loadCues={loadCalendarCues}
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
