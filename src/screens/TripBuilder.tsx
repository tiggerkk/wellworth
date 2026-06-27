import { useCallback, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import {
  IconBan,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { StarRating } from '../components/StarRating'
import { Toggle } from '../components/Toggle'
import { Thumb } from '../components/Thumb'
import { Calendar } from '../components/Calendar'
import { ReorderList } from '../components/ReorderList'
import { SecondaryButton } from '../components/SecondaryButton'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { StopEditorSheet } from '../components/StopEditorSheet'
import { TripExpensesPanel } from '../components/TripExpensesPanel'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  createDay,
  createStops,
  createTrip,
  deleteDay,
  deleteStop,
  deleteTrip,
  getTripBundle,
  recomputeTripDates,
  reorderDays,
  reorderStops,
  updateDay,
  updateStop,
  updateTrip,
} from '../data/travel'
import { bumpTravel, useTravelVersion } from '../lib/travel-refresh'
import { CURRENCIES, TRIP_STATUSES } from '../constants/travel'
import {
  isFieldVisible,
  stopTypeLabel,
  tripStatusLabel,
  type StopRow,
  type TripBundle,
  type TripDayRow,
} from '../lib/travel'
import { useProfile } from '../hooks/useProfile'
import { routes } from '../constants/routes'
import { addDays, formatFullDate, todayLocal } from '../lib/date'

const inputClass =
  'w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none'

export function TripBuilder() {
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
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const userId = session?.user.id
  const [name, setName] = useState('')
  const [status, setStatus] = useState<(typeof TRIP_STATUSES)[number]>('planning')
  const [baseCurrency, setBaseCurrency] = useState('CNY')
  const [saving, setSaving] = useState(false)

  // Close → go back if we arrived from within the app, else land on the Trips list (so a direct
  // load / refresh of this route still has somewhere sensible to go).
  const close = () =>
    location.key === 'default' ? navigate(routes.travel.trips) : navigate(-1)
  useEscapeKey(close)

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
      navigate(routes.travel.edit(trip.id), { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={close} aria-label="Close" className="text-text-secondary">
          <IconX size={22} />
        </button>
        <h1 className="flex-1 text-[17px] font-medium text-text-primary">New Trip</h1>
        <EntryHeaderActions
          editing={false}
          dirty={name.trim() !== '' || status !== 'planning' || baseCurrency !== 'CNY'}
          saving={saving}
          canSubmit={!!name.trim()}
          onReset={() => {
            setName('')
            setStatus('planning')
            setBaseCurrency('CNY')
          }}
          onSubmit={() => void create()}
        />
      </header>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex gap-3">
          <label className="flex-1 text-xs text-text-secondary">
            Trip Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="w-28 text-xs text-text-secondary">
            Base Currency
            <div className="mt-1">
              <SelectMenu
                value={baseCurrency}
                onChange={setBaseCurrency}
                ariaLabel="Base currency"
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>
        </div>
        <div className="w-40 text-xs text-text-secondary">
          Status
          <div className="mt-1">
            <SelectMenu
              value={status}
              onChange={(v) => setStatus(v as (typeof TRIP_STATUSES)[number])}
              ariaLabel="Status"
              options={TRIP_STATUSES.map((s) => ({
                value: s,
                label: tripStatusLabel(s),
              }))}
            />
          </div>
        </div>
        <p className="px-1 text-xs text-text-tertiary">
          Add days, stops, and the rest of the trip details after you create it.
        </p>
      </div>
    </div>
  )
}

// --- Edit trip: header + Itinerary (Days → Stops) + Expenses placeholder ---

function EditTrip({ id }: { id: string }) {
  const version = useTravelVersion()
  const fn = useCallback(() => {
    void version
    return getTripBundle(id)
  }, [id, version])
  const { data: bundle, loading, error } = useAsync(fn)

  // Keep the body mounted across background refetches (a day/stop/expense write bumps the version →
  // `useAsync` flips `loading` true but retains the prior `bundle`). Gating on `!loading` here would
  // unmount the body on every itinerary edit and discard the header's unsaved local state.
  return (
    <div className="flex h-full flex-col">
      {loading && !bundle && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {error && !bundle && (
        <p className="p-4 text-sm text-danger">Couldn’t load this trip.</p>
      )}
      {bundle && <EditTripBody key={id} bundle={bundle} />}
    </div>
  )
}

function EditTripBody({ bundle }: { bundle: TripBundle }) {
  const navigate = useNavigate()
  const location = useLocation()
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
  // Re-seed when a fetch replaces the bundle — only on an error-triggered bump, since itinerary edits
  // don't bump. React's "adjust state during render" pattern (not an effect), so no cascading render.
  const [syncedBundle, setSyncedBundle] = useState(bundle)
  if (syncedBundle !== bundle) {
    setSyncedBundle(bundle)
    setDays(bundle.days)
    setStops(bundle.stops)
  }
  const [tab, setTab] = useState<'itinerary' | 'expenses'>('itinerary')

  // Close → back if we came from within the app, else fall back to the Trips list.
  const close = () =>
    location.key === 'default' ? navigate(routes.travel.trips) : navigate(-1)
  useEscapeKey(close)

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

  const stopsByDay = (dayId: string) =>
    stops
      .filter((s) => s.trip_day_id === dayId)
      .sort((a, b) => a.sort_order - b.sort_order)

  const dayLabel = (day: TripDayRow, index: number) =>
    `Day ${index + 1}${day.day_date ? ` · ${formatFullDate(day.day_date)}` : ''}`

  // Header dirty-check + reset (mirrors the other modules' Entry/Edit forms). Days/stops/expenses
  // auto-save on each change; this guards only the header fields.
  const headerDirty =
    name !== trip.name ||
    status !== trip.status ||
    baseCurrency !== trip.base_currency ||
    coverUrl !== (trip.cover_url ?? '') ||
    companions !== (trip.companions ?? '') ||
    rating !== (trip.rating ?? 0) ||
    notes !== (trip.notes ?? '') ||
    trackReimb !== trip.track_reimbursement

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
      navigate(-1) // SAVE returns to where the user came from (Trips/Map/Dashboard)
    } finally {
      setSavingHeader(false)
    }
  }

  async function removeTrip() {
    setSavingHeader(true)
    try {
      await deleteTrip(trip.id)
      bumpTravel()
      navigate(-1)
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
    if (!confirm('Delete this day and its stops?')) return
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

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={close} aria-label="Close" className="text-text-secondary">
          <IconX size={22} />
        </button>
        <h1 className="flex-1 truncate text-[17px] font-medium text-text-primary">
          Edit Trip
        </h1>
        <EntryHeaderActions
          editing
          dirty={headerDirty}
          saving={savingHeader}
          canSubmit={!!name.trim()}
          onReset={resetHeader}
          onSubmit={() => void saveHeader()}
          onDelete={() => void removeTrip()}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Trip header fields */}
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          {/* Row 1: Trip Name + Status */}
          <div className="flex gap-3">
            <label className="flex-1 text-xs text-text-secondary">
              Trip Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <div className="flex-1 text-xs text-text-secondary">
              Status
              <div className="mt-1">
                <SelectMenu
                  value={status}
                  onChange={setStatus}
                  ariaLabel="Status"
                  options={TRIP_STATUSES.map((s) => ({
                    value: s,
                    label: tripStatusLabel(s),
                  }))}
                />
              </div>
            </div>
          </div>
          {/* Row 2: Companions + Rating */}
          {(show('companions') || show('rating')) && (
            <div className="flex gap-3">
              {show('companions') && (
                <label className="flex-1 text-xs text-text-secondary">
                  Companions
                  <input
                    value={companions}
                    onChange={(e) => setCompanions(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
              )}
              {show('rating') && (
                <div className="text-xs text-text-secondary">
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
            <label className="text-xs text-text-secondary">
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
              <label className="text-xs text-text-secondary">
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
          <section className="flex gap-3 rounded-card border border-border bg-surface p-4">
            <div className="w-28 text-xs text-text-secondary">
              Base Currency
              <div className="mt-1">
                <SelectMenu
                  value={baseCurrency}
                  onChange={setBaseCurrency}
                  ariaLabel="Base currency"
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                />
              </div>
            </div>
            <div className="text-xs text-text-secondary">
              Track Reimburse
              <div className="mt-1 flex h-[38px] items-center">
                <Toggle
                  checked={trackReimb}
                  onChange={setTrackReimb}
                  label="Track reimbursement"
                />
              </div>
            </div>
          </section>
        )}

        {tab === 'itinerary' ? (
          <section className="flex flex-col gap-4">
            <div className="flex gap-2">
              <SecondaryButton size="sm" onClick={() => void addDay()}>
                <span className="inline-flex items-center gap-1 text-positive">
                  <IconPlus size={15} /> Add Day
                </span>
              </SecondaryButton>
              {days.length > 1 && (
                <SecondaryButton size="sm" onClick={() => setReorderDaysOpen(true)}>
                  Reorder Days
                </SecondaryButton>
              )}
            </div>

            {days.length === 0 && (
              <p className="px-1 text-sm text-text-secondary">
                No days yet — add your first day.
              </p>
            )}

            {days.map((day, i) => {
              const dayStops = stopsByDay(day.id)
              const expanded = !collapsedDays.has(day.id)
              return (
                <div
                  key={day.id}
                  className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
                >
                  {/* Day header: chevron · Day X · date · spacer · trash · copy · green + */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleDay(day.id)}
                      aria-label={
                        expanded ? `Collapse Day ${i + 1}` : `Expand Day ${i + 1}`
                      }
                      className="shrink-0 p-0.5 text-text-tertiary"
                    >
                      {expanded ? (
                        <IconChevronDown size={18} />
                      ) : (
                        <IconChevronRight size={18} />
                      )}
                    </button>
                    <span className="text-[15px] font-medium text-text-primary">
                      Day {i + 1}
                    </span>
                    <button
                      onClick={() => setDatePickerDay(day)}
                      aria-label={
                        day.day_date
                          ? `Change date for Day ${i + 1}`
                          : `Add a date for Day ${i + 1}`
                      }
                      className="flex items-center gap-1 rounded-pill bg-input px-2.5 py-1 text-left text-xs"
                    >
                      <IconCalendar size={14} className="shrink-0 text-text-secondary" />
                      {day.day_date ? (
                        <span className="text-text-primary">
                          {formatFullDate(day.day_date)}
                        </span>
                      ) : (
                        <span className="text-text-tertiary">Add date</span>
                      )}
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => void removeDay(day.id)}
                      aria-label="Delete day"
                      className="p-1 text-text-secondary"
                    >
                      <IconTrash size={18} />
                    </button>
                    <button
                      onClick={() => void duplicateDay(day)}
                      aria-label="Duplicate day"
                      className="p-1 text-text-secondary"
                    >
                      <IconCopy size={18} />
                    </button>
                    <button
                      onClick={() => setStopEditor({ dayId: day.id })}
                      aria-label="Add stop"
                      className="p-1 text-positive"
                    >
                      <IconPlus size={18} stroke={2.25} />
                    </button>
                  </div>

                  {expanded &&
                    dayStops.length > 0 &&
                    (() => {
                      const runs = cityRuns(dayStops)
                      return (
                        <div className="flex flex-col gap-2">
                          {runs.map((run, runIdx) => (
                            <div key={runIdx} className="flex flex-col gap-1">
                              {run.city && (
                                <h3 className="px-1 text-[13px] font-medium text-text-primary">
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
                                      className={`w-full truncate text-left ${
                                        s.completion === 'skipped'
                                          ? 'text-text-tertiary line-through'
                                          : ''
                                      }`}
                                    >
                                      <span className="text-text-secondary">
                                        {stopTypeLabel(s.type)}
                                      </span>
                                      {' · '}
                                      {s.description || '—'}
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
                        </div>
                      )
                    })()}
                </div>
              )
            })}
          </section>
        ) : userId ? (
          <TripExpensesPanel trip={trip} userId={userId} />
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
        <StopEditorSheet
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
  useEscapeKey(onClose)
  const indexById = new Map(days.map((d, i) => [d.id, i]))
  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reorder days"
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-card bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h1 className="flex-1 text-[17px] font-medium text-text-primary">
            Reorder Days
          </h1>
          <button onClick={onClose} aria-label="Done" className="text-text-secondary">
            <IconX size={22} />
          </button>
        </header>
        <div className="p-4">
          <ReorderList
            ids={days.map((d) => d.id)}
            onReorder={onReorder}
            renderLabel={(id) => {
              const d = days.find((x) => x.id === id)!
              return label(d, indexById.get(id) ?? 0)
            }}
          />
        </div>
      </div>
    </div>
  )
}
