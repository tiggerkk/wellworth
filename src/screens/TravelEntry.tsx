import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import {
  IconBan,
  IconCalendar,
  IconCheck,
  IconCopy,
  IconPlus,
  IconReceipt2,
} from '@tabler/icons-react'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { StarRating } from '../components/StarRating'
import { Toggle } from '../components/Toggle'
import { Thumb } from '../components/Thumb'
import { Calendar } from '../components/Calendar'
import { ReorderList } from '../components/ReorderList'
import { FIELD_CLASS as inputClass } from '../constants/forms'
import { SecondaryButton } from '../components/SecondaryButton'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ConfirmDeleteAction } from '../components/ConfirmDeleteAction'
import { IconAction } from '../components/IconAction'
import { StopEditorOverlay } from '../components/StopEditorOverlay'
import { StopTypeIcon } from '../components/StopTypeIcon'
import { Collapsible } from '../components/Collapsible'
import { OverlayBottom } from '../components/OverlayBottom'
import { TravelExpensesPanel } from '../components/TravelExpensesPanel'
import { DayExpensesOverlay } from '../components/DayExpensesOverlay'
import { EntryLoader } from '../components/EntryLoader'
import type { ExpenseDraft } from '../components/ExpenseRowsEditor'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useEntryClose } from '../hooks/useEntryClose'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  createDay,
  createExpense,
  createStops,
  createTrip,
  deleteDay,
  deleteExpense,
  deleteStop,
  deleteTrip,
  getTripBundle,
  recomputeTripDates,
  reorderDays,
  reorderExpenses,
  reorderStops,
  updateDay,
  updateExpense,
  updateStop,
  updateTrip,
} from '../data/travel'
import { bumpTravel, useTravelVersion } from '../lib/travel-refresh'
import {
  CURRENCIES,
  STOP_TYPE_LABELS,
  TRIP_STATUSES,
  TRIP_STATUS_LABELS,
  type StopType,
} from '../constants/travel'
import {
  isFieldVisible,
  type StopRow,
  type TripBundle,
  type TripDayRow,
} from '../lib/travel'
import type { ExpenseRow, ExpenseUpdate } from '../lib/travel-expenses'
import { effectiveCategories } from '../lib/travel-config'
import { useProfile } from '../hooks/useProfile'
import { routes } from '../constants/routes'
import { addDays, formatFullDate, todayLocal } from '../lib/date'

export function TravelEntry() {
  const { id } = useParams()
  return id ? <EditTrip id={id} /> : <NewTrip />
}

/** Split a day's ordered stops into consecutive same-city runs (city '' groups the unset stops). */
function cityRuns(stops: StopRow[]): { city: string; stops: StopRow[] }[] {
  const runs: { city: string; stops: StopRow[] }[] = []
  for (const s of stops) {
    const c = s.city ?? ''
    const last = runs[runs.length - 1]
    if (last && last.city === c) last.stops.push(s)
    else runs.push({ city: c, stops: [s] })
  }
  return runs
}

// --- New trip: header only; Days/Stops unlock once the trip exists ---

function NewTrip() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [name, setName] = useState('')
  const [status, setStatus] = useState<(typeof TRIP_STATUSES)[number]>('planning')
  const [baseCurrency, setBaseCurrency] = useState('CNY')
  const [saving, setSaving] = useState(false)

  const dirty = name.trim() !== '' || status !== 'planning' || baseCurrency !== 'CNY'
  const { requestClose, afterSave, confirm } = useEntryClose({
    editing: false,
    dirty,
    listing: routes.travel.trips,
    editRoute: routes.travel.edit,
  })
  useEscapeKey(requestClose)

  async function create() {
    if (!userId || !name.trim()) return
    setSaving(true)
    try {
      const trip = await createTrip({
        user_id: userId,
        name: name.trim(),
        status,
        base_currency: baseCurrency,
      })
      bumpTravel()
      afterSave(trip.id, 'Trip created')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderTitle
        title="New Trip"
        icon="close"
        onClose={requestClose}
        actions={
          <EntryHeaderActions
            editing={false}
            dirty={dirty}
            saving={saving}
            canSubmit={!!name.trim()}
            onReset={() => {
              setName('')
              setStatus('planning')
              setBaseCurrency('CNY')
            }}
            onSubmit={() => void create()}
          />
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex gap-3">
          <label className="flex-1 text-caption text-text-secondary">
            Trip Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="w-32 text-caption text-text-secondary">
            Default Currency
            <div className="mt-1">
              <SelectMenu
                value={baseCurrency}
                onChange={setBaseCurrency}
                ariaLabel="Default currency"
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>
        </div>
        <div className="w-40 text-caption text-text-secondary">
          Status
          <div className="mt-1">
            <SelectMenu
              value={status}
              onChange={(v) => setStatus(v as (typeof TRIP_STATUSES)[number])}
              ariaLabel="Status"
              options={TRIP_STATUSES.map((s) => ({
                value: s,
                label: TRIP_STATUS_LABELS[s],
              }))}
            />
          </div>
        </div>
        <p className="px-1 text-caption text-text-tertiary">
          Add days, stops, and the rest of the trip details after you create it.
        </p>
      </div>

      <ConfirmDialog
        open={confirm.open}
        title="Discard changes?"
        message="You have unsaved changes to this trip. Discard them?"
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </div>
  )
}

// --- Edit trip: header + Itinerary (Days → Stops) + Expenses placeholder ---

function EditTrip({ id }: { id: string }) {
  const { requestClose } = useEntryClose({
    editing: true,
    dirty: false, // nothing is loaded yet at this stage — see EditTripBody for the real dirty check
    listing: routes.travel.trips,
    editRoute: routes.travel.edit,
    dashboard: routes.travel.dashboard,
  })

  const version = useTravelVersion()
  const fn = useCallback(() => {
    void version
    return getTripBundle(id)
  }, [id, version])
  const { data: rawBundle, loading, error } = useAsync(fn)

  // Guard against `useAsync`'s stale-while-revalidate behavior: after navigating from Edit(A) to
  // Edit(B) (e.g. Close after creating a new trip), `rawBundle` can still hold A's data for one
  // render while B's fetch is in flight. Treating a mismatched bundle as "not loaded yet" — rather
  // than trusting it — is what fixes "Close on the new trip lands on the previous trip's Edit
  // screen but shows the new trip's data": EditTripBody (keyed by `id`) now never mounts/reseeds
  // its header fields from a bundle that belongs to a different trip.
  const bundle = rawBundle && rawBundle.trip.id === id ? rawBundle : undefined

  // Keep the body mounted across background refetches (a day/stop/expense write bumps the version →
  // `useAsync` flips `loading` true but retains the prior `bundle`). Gating on `!loading` here would
  // unmount the body on every itinerary edit and discard the header's unsaved local state. Passing
  // `loading`/`error` through `!bundle` reproduces that: once `bundle` exists, EntryLoader always
  // renders the body regardless of a background loading/error state.
  return (
    <div className="flex h-full flex-col">
      {!bundle && (
        <ScreenHeaderTitle title="Edit Trip" icon="back" onClose={requestClose} />
      )}
      <EntryLoader
        loading={loading && !bundle}
        error={error && !bundle ? error : undefined}
        data={bundle}
        errorText="Couldn’t load this trip."
        className="contents"
      >
        {(b) => <EditTripBody key={id} bundle={b} />}
      </EntryLoader>
    </div>
  )
}

function EditTripBody({ bundle }: { bundle: TripBundle }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  const show = (key: string) =>
    isFieldVisible(profile?.travel_visible_fields ?? null, key)
  const { trip } = bundle
  // Itinerary held in LOCAL state so every structural edit (add/copy/delete/reorder a day or stop,
  // done/skipped, date) updates instantly and never triggers a full-bundle refetch — the days+stops
  // read is the expensive part. Each op persists in the background; on a write error we `bumpTravel()`
  // to refetch, and this effect re-seeds local state from the corrected bundle. On the happy path we
  // never bump for itinerary, so `bundle` is stable and the effect doesn't clobber optimistic edits.
  const [days, setDays] = useState<TripDayRow[]>(bundle.days)
  const [stops, setStops] = useState<StopRow[]>(bundle.stops)
  // Expenses share the same optimistic local-state model as days/stops (the day modal and the Expenses
  // tab edit the one list). Held ordered by (expense_date, sort_order); see the helpers below.
  const [expenses, setExpenses] = useState<ExpenseRow[]>(bundle.expenses)
  // Re-seed when a fetch replaces the bundle — only on an error-triggered bump, since itinerary edits
  // don't bump. React's "adjust state during render" pattern (not an effect), so no cascading render.
  const [syncedBundle, setSyncedBundle] = useState(bundle)
  if (syncedBundle !== bundle) {
    setSyncedBundle(bundle)
    setDays(bundle.days)
    setStops(bundle.stops)
    setExpenses(bundle.expenses)
  }
  const [tab, setTab] = useState<'itinerary' | 'expenses'>('itinerary')
  const [dayExpensesFor, setDayExpensesFor] = useState<TripDayRow | null>(null)

  const categories = useMemo(
    () => effectiveCategories(profile?.travel_expense_categories ?? null),
    [profile],
  )

  // Header local draft (the trip already exists, so this is Save, not Create).
  const [name, setName] = useState(trip.name)
  const [status, setStatus] = useState(trip.status)
  const [baseCurrency, setBaseCurrency] = useState(trip.base_currency)
  const [coverUrl, setCoverUrl] = useState(trip.cover_url ?? '')
  const [companions, setCompanions] = useState(trip.companions ?? '')
  const [rating, setRating] = useState(trip.rating ?? 0)
  const [notes, setNotes] = useState(trip.notes ?? '')
  const [trackReimb, setTrackReimb] = useState(trip.track_reimbursement)
  const [savingHeader, setSavingHeader] = useState(false)

  const [datePickerDay, setDatePickerDay] = useState<TripDayRow | null>(null)
  const [reorderDaysOpen, setReorderDaysOpen] = useState(false)
  const [stopEditor, setStopEditor] = useState<{ dayId: string; stop?: StopRow } | null>(
    null,
  )
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())
  const toggleDay = (id: string) =>
    setCollapsedDays((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Grouped once per `stops` change (a single pass + per-group sort) instead of re-filtering and
  // re-sorting the WHOLE trip's stops for every day on every render — `days.map` below calls
  // `stopsByDay` once per day, so that was O(days × stops); this is O(stops log stops) total, then
  // an O(1) lookup per day. Matters once a trip accumulates many days/stops, and this component
  // re-renders on every keystroke in the header fields (name/notes/companions/etc), not just on
  // itinerary edits.
  const stopsByDayId = useMemo(() => {
    const map = new Map<string, StopRow[]>()
    for (const s of stops) {
      const arr = map.get(s.trip_day_id)
      if (arr) arr.push(s)
      else map.set(s.trip_day_id, [s])
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sort_order - b.sort_order)
    return map
  }, [stops])
  const stopsByDay = (dayId: string) => stopsByDayId.get(dayId) ?? []

  const dayLabel = (day: TripDayRow, index: number) =>
    `Day ${index + 1}${day.day_date ? ` · ${formatFullDate(day.day_date)}` : ''}`

  // Header dirty-check + reset. Days/stops/expenses auto-save on each change; this guards only the header fields.
  const headerDirty =
    name !== trip.name ||
    status !== trip.status ||
    baseCurrency !== trip.base_currency ||
    coverUrl !== (trip.cover_url ?? '') ||
    companions !== (trip.companions ?? '') ||
    rating !== (trip.rating ?? 0) ||
    notes !== (trip.notes ?? '') ||
    trackReimb !== trip.track_reimbursement

  const { requestClose, afterSave, confirm } = useEntryClose({
    editing: true,
    dirty: headerDirty,
    listing: routes.travel.trips,
    editRoute: routes.travel.edit,
    dashboard: routes.travel.dashboard,
  })
  useEscapeKey(requestClose)

  function resetHeader() {
    setName(trip.name)
    setStatus(trip.status)
    setBaseCurrency(trip.base_currency)
    setCoverUrl(trip.cover_url ?? '')
    setCompanions(trip.companions ?? '')
    setRating(trip.rating ?? 0)
    setNotes(trip.notes ?? '')
    setTrackReimb(trip.track_reimbursement)
  }

  async function saveHeader() {
    if (!name.trim()) return
    setSavingHeader(true)
    try {
      await updateTrip(trip.id, {
        name: name.trim(),
        status,
        base_currency: baseCurrency,
        cover_url: coverUrl.trim() || null,
        companions: companions.trim() || null,
        rating: rating || null,
        notes: notes.trim() || null,
        track_reimbursement: trackReimb,
      })
      bumpTravel()
      afterSave(trip.id, 'Trip saved')
    } finally {
      setSavingHeader(false)
    }
  }

  async function removeTrip() {
    setSavingHeader(true)
    try {
      await deleteTrip(trip.id)
      bumpTravel()
      afterSave(trip.id, 'Trip deleted')
    } finally {
      setSavingHeader(false)
    }
  }

  // All itinerary handlers below follow one shape: mutate local state for instant feedback, persist in
  // the background, and `bumpTravel()` ONLY on a write error (forces a refetch → the sync effect
  // re-seeds from server truth). No bump on success, so they never pay the full-bundle refetch.

  async function addDay() {
    // Default the new day to the day after the previous (dated) day.
    const prev = days[days.length - 1]
    const nextDate = prev?.day_date ? addDays(prev.day_date, 1) : null
    try {
      const created = await createDay({
        user_id: userId!,
        trip_id: trip.id,
        day_date: nextDate,
        sort_order: days.length,
      })
      setDays((d) => [...d, created])
      if (nextDate) void recomputeTripDates(trip.id)
    } catch {
      bumpTravel()
    }
  }

  // Inline done/skipped — tapping the active state clears it. `completion` has no cross-screen
  // consumer (Map/facets remount fresh), so the optimistic local write needs no bump.
  async function setStopCompletion(s: StopRow, value: 'done' | 'skipped') {
    const next = s.completion === value ? null : value
    setStops((st) => st.map((x) => (x.id === s.id ? { ...x, completion: next } : x)))
    try {
      await updateStop(s.id, { completion: next })
    } catch {
      bumpTravel()
    }
  }

  // City/province/country carried forward to a NEW stop: the day's last stop, else the most
  // recent prior day's last stop (typical 1-city-per-day flow needs no city input at all).
  function carryForwardCity(forDayId: string): {
    city: string
    province: string
    country: string
  } {
    const ordered = [...days].sort((a, b) => a.sort_order - b.sort_order)
    const startIdx = ordered.findIndex((d) => d.id === forDayId)
    for (let i = startIdx; i >= 0; i--) {
      const dayStops = stopsByDay(ordered[i]!.id)
      if (dayStops.length > 0) {
        const last = dayStops[dayStops.length - 1]!
        return {
          city: last.city ?? '',
          province: last.province ?? '',
          country: last.country ?? '',
        }
      }
    }
    return { city: '', province: '', country: '' }
  }

  async function removeDay(dayId: string) {
    setDays((d) => d.filter((x) => x.id !== dayId))
    setStops((st) => st.filter((x) => x.trip_day_id !== dayId))
    try {
      await deleteDay(dayId)
      void recomputeTripDates(trip.id)
    } catch {
      bumpTravel()
    }
  }

  async function duplicateDay(day: TripDayRow) {
    const src = stopsByDay(day.id)
    try {
      const copy = await createDay({
        user_id: userId!,
        trip_id: trip.id,
        day_date: day.day_date,
        label: day.label,
        sort_order: days.length,
      })
      setDays((d) => [...d, copy])
      if (src.length > 0) {
        // One bulk insert for the copied stops (was a per-stop sequential loop — N round-trips).
        const created = await createStops(
          src.map((s, i) => ({
            user_id: userId!,
            trip_day_id: copy.id,
            type: s.type,
            city: s.city,
            country: s.country,
            province: s.province,
            description: s.description,
            details: s.details,
            completion: s.completion,
            sort_order: i,
          })),
        )
        setStops((st) => [...st, ...created])
      }
      if (day.day_date) void recomputeTripDates(trip.id)
    } catch {
      bumpTravel()
    }
  }

  async function pickDate(iso: string) {
    if (!datePickerDay) return
    const dayId = datePickerDay.id
    setDays((d) => d.map((x) => (x.id === dayId ? { ...x, day_date: iso } : x)))
    setDatePickerDay(null)
    try {
      await updateDay(dayId, { day_date: iso })
      void recomputeTripDates(trip.id)
    } catch {
      bumpTravel()
    }
  }

  async function removeStop(stopId: string) {
    setStops((st) => st.filter((x) => x.id !== stopId))
    try {
      await deleteStop(stopId)
    } catch {
      bumpTravel()
    }
  }

  // --- Expense handlers (same optimistic shape as stops). `sort_order` orders a row within its
  // (trip, expense_date) group; a new/re-dated row lands at the end of its date group. ---
  const nextExpenseSort = (date: string | null, excludeId?: string) =>
    expenses.filter((e) => e.id !== excludeId && (e.expense_date ?? null) === date).length

  async function addExpense(draft: ExpenseDraft) {
    if (!userId) return
    try {
      const saved = await createExpense({
        user_id: userId,
        trip_id: trip.id,
        expense_date: draft.expense_date,
        description: draft.description,
        category: draft.category,
        cost: draft.cost,
        currency: draft.currency,
        sort_order: nextExpenseSort(draft.expense_date),
      })
      setExpenses((prev) => [...prev, saved])
    } catch {
      bumpTravel()
    }
  }

  async function editExpense(id: string, patch: ExpenseUpdate) {
    // Re-dating moves the row to the end of its new date group (fresh sort_order there).
    const finalPatch: ExpenseUpdate =
      patch.expense_date !== undefined
        ? { ...patch, sort_order: nextExpenseSort(patch.expense_date ?? null, id) }
        : patch
    setExpenses((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...finalPatch } : e))
      if (patch.expense_date === undefined) return next
      // Keep the re-dated row last in array order so it groups at the end of its new date.
      const moved = next.find((e) => e.id === id)!
      return [...next.filter((e) => e.id !== id), moved]
    })
    try {
      await updateExpense(id, finalPatch)
    } catch {
      bumpTravel()
    }
  }

  async function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    try {
      await deleteExpense(id)
    } catch {
      bumpTravel()
    }
  }

  async function reorderExpensesInGroup(orderedIds: string[]) {
    const pos = new Map(orderedIds.map((id, i) => [id, i]))
    setExpenses((prev) => {
      const ordered = prev
        .filter((e) => pos.has(e.id))
        .sort((a, b) => pos.get(a.id)! - pos.get(b.id)!)
      let k = 0
      return prev.map((e) => (pos.has(e.id) ? ordered[k++]! : e))
    })
    try {
      await reorderExpenses(orderedIds)
    } catch {
      bumpTravel()
    }
  }

  return (
    <>
      <ScreenHeaderTitle
        title="Edit Trip"
        icon="back"
        onClose={requestClose}
        actions={
          <EntryHeaderActions
            editing
            dirty={headerDirty}
            saving={savingHeader}
            canSubmit={!!name.trim()}
            onReset={resetHeader}
            onSubmit={() => void saveHeader()}
            onDelete={() => void removeTrip()}
          />
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Trip header fields */}
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          {/* Row 1: Trip Name + Status */}
          <div className="flex gap-3">
            <label className="flex-1 text-caption text-text-secondary">
              Trip Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <div className="flex-1 text-caption text-text-secondary">
              Status
              <div className="mt-1">
                <SelectMenu
                  value={status}
                  onChange={setStatus}
                  ariaLabel="Status"
                  options={TRIP_STATUSES.map((s) => ({
                    value: s,
                    label: TRIP_STATUS_LABELS[s],
                  }))}
                />
              </div>
            </div>
          </div>
          {/* Row 2: Companions + Rating */}
          {(show('companions') || show('rating')) && (
            <div className="flex gap-3">
              {show('companions') && (
                <label className="flex-1 text-caption text-text-secondary">
                  Companions
                  <input
                    value={companions}
                    onChange={(e) => setCompanions(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
              )}
              {show('rating') && (
                <div className="text-caption text-text-secondary">
                  Rating
                  <div className="mt-1 flex h-8 items-center">
                    <StarRating value={rating} onChange={setRating} />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Row 3: Notes */}
          {show('notes') && (
            <label className="text-caption text-text-secondary">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`mt-1 resize-none ${inputClass}`}
              />
            </label>
          )}
          {/* Row 4: Cover Image URL */}
          {show('cover_url') && (
            <>
              <label className="text-caption text-text-secondary">
                Cover Image URL
                <input
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://…"
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              {coverUrl.trim() && (
                <Thumb url={coverUrl.trim()} className="h-28 w-full rounded-card" />
              )}
            </>
          )}
        </section>

        <SegmentedTabs<'itinerary' | 'expenses'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'itinerary', label: 'Itinerary' },
            { value: 'expenses', label: 'Expenses' },
          ]}
        />

        {tab === 'expenses' && (
          <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-border bg-surface px-3 py-2">
            <span className="text-caption text-text-secondary">Default Currency</span>
            <div className="w-24">
              <SelectMenu
                value={baseCurrency}
                onChange={setBaseCurrency}
                ariaLabel="Default currency"
                size="compact"
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-caption text-text-secondary">Track Reimburse</span>
              <Toggle
                checked={trackReimb}
                onChange={setTrackReimb}
                label="Track reimbursement"
              />
            </div>
          </section>
        )}

        {tab === 'itinerary' ? (
          <section className="flex flex-col gap-4">
            {days.length > 1 && (
              <div className="flex gap-2">
                <SecondaryButton size="sm" onClick={() => setReorderDaysOpen(true)}>
                  Reorder Days
                </SecondaryButton>
              </div>
            )}

            {days.length === 0 && (
              <p className="px-1 text-body text-text-secondary">
                No days yet — add your first day.
              </p>
            )}

            {days.map((day, i) => {
              const dayStops = stopsByDay(day.id)
              const expanded = !collapsedDays.has(day.id)
              return (
                <Collapsible
                  key={day.id}
                  title={`Day ${i + 1}`}
                  titleGrow={false}
                  bodyClassName="flex flex-col gap-2 p-3"
                  open={expanded}
                  onOpenChange={() => toggleDay(day.id)}
                  actions={
                    <>
                      <button
                        onClick={() => setDatePickerDay(day)}
                        aria-label={
                          day.day_date
                            ? `Change date for Day ${i + 1}`
                            : `Add a date for Day ${i + 1}`
                        }
                        className="flex items-center gap-1 rounded-pill bg-input px-2.5 py-1 text-left text-body"
                      >
                        <IconCalendar
                          size={16}
                          className="shrink-0 text-text-secondary"
                        />
                        {day.day_date ? (
                          <span className="text-text-primary">
                            {formatFullDate(day.day_date)}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">Add date</span>
                        )}
                      </button>
                      <div className="flex-1" />
                      <ConfirmDeleteAction
                        label="Delete day"
                        onDelete={() => void removeDay(day.id)}
                      />
                      <IconAction
                        Icon={IconCopy}
                        label="Duplicate day"
                        onClick={() => void duplicateDay(day)}
                      />
                      <button
                        onClick={() => setDayExpensesFor(day)}
                        aria-label={`Expenses for Day ${i + 1}`}
                        className="p-1 text-accent"
                      >
                        <IconReceipt2 size={18} />
                      </button>
                      <button
                        onClick={() => setStopEditor({ dayId: day.id })}
                        aria-label="Add stop"
                        className="p-1 text-positive"
                      >
                        <IconPlus size={18} stroke={2.25} />
                      </button>
                    </>
                  }
                >
                  {dayStops.length > 0 &&
                    (() => {
                      const runs = cityRuns(dayStops)
                      return (
                        <>
                          {runs.map((run, runIdx) => (
                            <div key={runIdx} className="flex flex-col gap-1">
                              {run.city && (
                                <h3 className="px-1 text-body font-medium text-text-primary">
                                  {run.city}
                                </h3>
                              )}
                              <ReorderList
                                ids={run.stops.map((s) => s.id)}
                                onReorder={(nextRun) => {
                                  // Rebuild the whole day's order with this run replaced.
                                  const nextDay = runs.flatMap((r, i) =>
                                    i === runIdx ? nextRun : r.stops.map((s) => s.id),
                                  )
                                  // Optimistic: re-stamp sort_order locally (render re-sorts), persist
                                  // in the background; resync on error.
                                  const order = new Map(nextDay.map((id, i) => [id, i]))
                                  setStops((st) =>
                                    st.map((s) =>
                                      order.has(s.id)
                                        ? { ...s, sort_order: order.get(s.id)! }
                                        : s,
                                    ),
                                  )
                                  void reorderStops(nextDay).catch(() => bumpTravel())
                                }}
                                onDelete={(sid) => void removeStop(sid)}
                                handleLabel={() => 'Drag to reorder stop'}
                                renderLabel={(sid) => {
                                  const s = run.stops.find((x) => x.id === sid)!
                                  return (
                                    <button
                                      onClick={() =>
                                        setStopEditor({ dayId: day.id, stop: s })
                                      }
                                      aria-label={`${STOP_TYPE_LABELS[s.type as StopType]}: ${
                                        s.description || 'no description'
                                      }`}
                                      className={`flex w-full items-center gap-1.5 text-left ${
                                        s.completion === 'skipped'
                                          ? 'text-text-tertiary line-through'
                                          : ''
                                      }`}
                                    >
                                      <StopTypeIcon type={s.type} className="shrink-0" />
                                      <span className="truncate">
                                        {s.description || '—'}
                                      </span>
                                    </button>
                                  )
                                }}
                                renderTrailing={(sid) => {
                                  const s = run.stops.find((x) => x.id === sid)!
                                  return (
                                    <div className="flex items-center gap-0.5">
                                      <button
                                        onClick={() => void setStopCompletion(s, 'done')}
                                        aria-label="Mark done"
                                        aria-pressed={s.completion === 'done'}
                                        className={`rounded-full p-1 ${
                                          s.completion === 'done'
                                            ? 'bg-positive text-bg'
                                            : 'text-text-secondary'
                                        }`}
                                      >
                                        <IconCheck size={15} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          void setStopCompletion(s, 'skipped')
                                        }
                                        aria-label="Mark skipped"
                                        aria-pressed={s.completion === 'skipped'}
                                        className={`rounded-full p-1 ${
                                          s.completion === 'skipped'
                                            ? 'bg-text-secondary text-bg'
                                            : 'text-text-secondary'
                                        }`}
                                      >
                                        <IconBan size={15} />
                                      </button>
                                    </div>
                                  )
                                }}
                              />
                            </div>
                          ))}
                        </>
                      )
                    })()}
                </Collapsible>
              )
            })}

            {/* Add Day sits at the bottom-right, below the last day. */}
            <div className="flex justify-end">
              <SecondaryButton size="sm" onClick={() => void addDay()}>
                <span className="inline-flex items-center gap-1 text-positive">
                  <IconPlus size={15} /> Add Day
                </span>
              </SecondaryButton>
            </div>
          </section>
        ) : userId ? (
          <TravelExpensesPanel
            trip={trip}
            expenses={expenses}
            categories={categories}
            defaultCurrency={baseCurrency}
            onAdd={(d) => void addExpense(d)}
            onUpdate={(id, patch) => void editExpense(id, patch)}
            onDelete={(id) => void removeExpense(id)}
            onReorder={(ids) => void reorderExpensesInGroup(ids)}
          />
        ) : null}
      </div>

      {datePickerDay && (
        <Calendar
          day={datePickerDay.day_date ?? trip.start_date ?? todayLocal()}
          onSelect={(iso) => void pickDate(iso)}
          onClose={() => setDatePickerDay(null)}
        />
      )}

      {reorderDaysOpen && (
        <ReorderDaysSheet
          days={days}
          label={dayLabel}
          onReorder={(ids) => {
            // Optimistic: reorder local days + re-stamp sort_order, persist in background.
            const order = new Map(ids.map((id, i) => [id, i]))
            setDays((d) =>
              [...d]
                .map((x) => ({ ...x, sort_order: order.get(x.id) ?? x.sort_order }))
                .sort((a, b) => a.sort_order - b.sort_order),
            )
            void reorderDays(ids).catch(() => bumpTravel())
          }}
          onClose={() => setReorderDaysOpen(false)}
        />
      )}

      {stopEditor && userId && (
        <StopEditorOverlay
          userId={userId}
          dayId={stopEditor.dayId}
          stop={stopEditor.stop}
          {...(stopEditor.stop
            ? {}
            : ((c) => ({
                defaultCity: c.city,
                defaultProvince: c.province,
                defaultCountry: c.country,
              }))(carryForwardCity(stopEditor.dayId)))}
          days={days.map((d, i) => ({ id: d.id, label: dayLabel(d, i) }))}
          onClose={() => setStopEditor(null)}
          onSaved={(saved) => {
            setStopEditor(null)
            // Merge the saved stop optimistically: replace on edit, append on add (no refetch).
            setStops((st) =>
              st.some((x) => x.id === saved.id)
                ? st.map((x) => (x.id === saved.id ? saved : x))
                : [...st, saved],
            )
          }}
          onDelete={
            stopEditor.stop
              ? () => {
                  void removeStop(stopEditor.stop!.id)
                  setStopEditor(null)
                }
              : undefined
          }
        />
      )}

      {dayExpensesFor && (
        <DayExpensesOverlay
          dayLabel={`Day ${days.findIndex((d) => d.id === dayExpensesFor.id) + 1}`}
          date={dayExpensesFor.day_date}
          defaultDate={dayExpensesFor.day_date ?? trip.start_date ?? todayLocal()}
          expenses={expenses.filter(
            (e) => (e.expense_date ?? null) === (dayExpensesFor.day_date ?? null),
          )}
          categories={categories}
          currencies={CURRENCIES}
          defaultCurrency={baseCurrency}
          trackReimbursement={trip.track_reimbursement}
          onAdd={(d) => void addExpense(d)}
          onUpdate={(id, patch) => void editExpense(id, patch)}
          onDelete={(id) => void removeExpense(id)}
          onReorder={(ids) => void reorderExpensesInGroup(ids)}
          onClose={() => setDayExpensesFor(null)}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Discard changes?"
        message="You have unsaved changes to this trip. Discard them?"
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </>
  )
}

function ReorderDaysSheet({
  days,
  label,
  onReorder,
  onClose,
}: {
  days: TripDayRow[]
  label: (day: TripDayRow, index: number) => string
  onReorder: (ids: string[]) => void
  onClose: () => void
}) {
  const indexById = new Map(days.map((d, i) => [d.id, i]))
  return (
    <OverlayBottom onClose={onClose} label="Reorder days">
      <ScreenHeaderTitle onClose={onClose} title="Reorder Days" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ReorderList
          ids={days.map((d) => d.id)}
          onReorder={onReorder}
          renderLabel={(id) => {
            const d = days.find((x) => x.id === id)!
            return label(d, indexById.get(id) ?? 0)
          }}
        />
      </div>
    </OverlayBottom>
  )
}
