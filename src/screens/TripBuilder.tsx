import { useCallback, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { IconCalendar, IconCopy, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { StarRating } from '../components/StarRating'
import { Toggle } from '../components/Toggle'
import { Thumb } from '../components/Thumb'
import { Calendar } from '../components/Calendar'
import { ReorderList } from '../components/ReorderList'
import { StatusChip } from '../components/StatusChip'
import { SecondaryButton } from '../components/SecondaryButton'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { StopEditorSheet } from '../components/StopEditorSheet'
import { TripExpensesPanel } from '../components/TripExpensesPanel'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  createDay,
  createStop,
  createTrip,
  deleteDay,
  deleteStop,
  deleteTrip,
  getTripBundle,
  recomputeTripDates,
  reorderDays,
  reorderStops,
  updateDay,
  updateTrip,
} from '../data/travel'
import { bumpTravel, useTravelVersion } from '../lib/travel-refresh'
import { CURRENCIES, TRIP_STATUSES } from '../constants/travel'
import {
  isFieldVisible,
  stopTypeLabel,
  timeHHMM,
  tripStatusLabel,
  type StopRow,
  type TripBundle,
  type TripDayRow,
} from '../lib/travel'
import { useProfile } from '../hooks/useProfile'
import { routes } from '../constants/routes'
import { formatFullDate, todayLocal } from '../lib/date'

const inputClass =
  'w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none'

export function TripBuilder() {
  const { id } = useParams()
  return id ? <EditTrip id={id} /> : <NewTrip />
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
  const { trip, days, stops } = bundle
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

  async function addDay() {
    await createDay({ user_id: userId!, trip_id: trip.id, sort_order: days.length })
    bumpTravel()
  }

  async function removeDay(dayId: string) {
    if (!confirm('Delete this day and its stops?')) return
    await deleteDay(dayId)
    await recomputeTripDates(trip.id)
    bumpTravel()
  }

  async function duplicateDay(day: TripDayRow) {
    const copy = await createDay({
      user_id: userId!,
      trip_id: trip.id,
      day_date: day.day_date,
      label: day.label,
      sort_order: days.length,
    })
    const src = stopsByDay(day.id)
    for (let i = 0; i < src.length; i++) {
      const s = src[i]!
      await createStop({
        user_id: userId!,
        trip_day_id: copy.id,
        type: s.type,
        city: s.city,
        country: s.country,
        province: s.province,
        description: s.description,
        details: s.details,
        time: s.time,
        cost: s.cost,
        cost_currency: s.cost_currency,
        local_transit: s.local_transit,
        travel_mode: s.travel_mode,
        from_loc: s.from_loc,
        to_loc: s.to_loc,
        completion: s.completion,
        sort_order: i,
      })
    }
    await recomputeTripDates(trip.id)
    bumpTravel()
  }

  async function pickDate(iso: string) {
    if (!datePickerDay) return
    await updateDay(datePickerDay.id, { day_date: iso })
    await recomputeTripDates(trip.id)
    setDatePickerDay(null)
    bumpTravel()
  }

  async function removeStop(stopId: string) {
    await deleteStop(stopId)
    bumpTravel()
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={close} aria-label="Close" className="text-text-secondary">
          <IconX size={22} />
        </button>
        <h1 className="flex-1 truncate text-[17px] font-medium text-text-primary">
          {trip.name}
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
          <div className="flex gap-3">
            <label className="flex-1 text-xs text-text-secondary">
              Trip Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
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
          <div className="flex gap-3">
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
            {show('rating') && (
              <div className="text-xs text-text-secondary">
                Rating
                <div className="mt-1 flex h-8 items-center">
                  <StarRating value={rating} onChange={setRating} />
                </div>
              </div>
            )}
          </div>
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
          {(show('companions') || show('track_reimbursement')) && (
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
              {show('track_reimbursement') && (
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
              )}
            </div>
          )}
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
        </section>

        <SegmentedTabs<'itinerary' | 'expenses'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'itinerary', label: 'Itinerary' },
            { value: 'expenses', label: 'Expenses' },
          ]}
        />

        {tab === 'itinerary' ? (
          <section className="flex flex-col gap-4">
            <div className="flex gap-2">
              <SecondaryButton size="sm" onClick={() => void addDay()}>
                <span className="inline-flex items-center gap-1">
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
              return (
                <div
                  key={day.id}
                  className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-2">
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
                      className="flex flex-1 items-center gap-1 rounded-pill bg-input px-2.5 py-1 text-left text-xs"
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
                    <button
                      onClick={() => void duplicateDay(day)}
                      aria-label="Duplicate day"
                      className="p-1 text-text-secondary"
                    >
                      <IconCopy size={18} />
                    </button>
                    <button
                      onClick={() => void removeDay(day.id)}
                      aria-label="Delete day"
                      className="p-1 text-text-secondary"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>

                  {dayStops.length > 0 && (
                    <ReorderList
                      ids={dayStops.map((s) => s.id)}
                      onReorder={(next) => {
                        void reorderStops(next).then(bumpTravel)
                      }}
                      handleLabel={() => 'Drag to reorder stop'}
                      renderLabel={(sid) => {
                        const s = dayStops.find((x) => x.id === sid)!
                        return (
                          <button
                            onClick={() => setStopEditor({ dayId: day.id, stop: s })}
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
                            {s.description || s.city || s.to_loc || '—'}
                            {s.time ? ` · ${timeHHMM(s.time)}` : ''}
                          </button>
                        )
                      }}
                      renderTrailing={(sid) => {
                        const s = dayStops.find((x) => x.id === sid)!
                        return s.completion === 'done' ? (
                          <StatusChip label="Done" className="bg-positive text-bg" />
                        ) : null
                      }}
                    />
                  )}

                  <button
                    onClick={() => setStopEditor({ dayId: day.id })}
                    className="flex items-center gap-1 self-start rounded-input px-2 py-1 text-sm text-accent"
                  >
                    <IconPlus size={15} /> Add Stop
                  </button>
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
          onReorder={(ids) => void reorderDays(ids).then(bumpTravel)}
          onClose={() => setReorderDaysOpen(false)}
        />
      )}

      {stopEditor && userId && (
        <StopEditorSheet
          userId={userId}
          dayId={stopEditor.dayId}
          stop={stopEditor.stop}
          defaultCurrency={baseCurrency}
          days={days.map((d, i) => ({ id: d.id, label: dayLabel(d, i) }))}
          onClose={() => setStopEditor(null)}
          onSaved={() => {
            setStopEditor(null)
            bumpTravel()
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
