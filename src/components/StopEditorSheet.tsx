import { useState } from 'react'
import { IconChevronRight, IconTrash, IconX } from '@tabler/icons-react'
import { SegmentedTabs } from './SegmentedTabs'
import { SelectMenu } from './SelectMenu'
import { PrimaryButton } from './PrimaryButton'
import { CitySearchSheet } from './CitySearchSheet'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { createStop, nextStopSortOrder, updateStop } from '../data/travel'
import {
  isTravelStop,
  timeHHMM,
  usesLocalTransit,
  type ResolvedCity,
  type StopRow,
} from '../lib/travel'
import {
  CURRENCIES,
  STOP_TYPES,
  STOP_TYPE_LABELS,
  TRAVEL_MODES,
  TRAVEL_MODE_LABELS,
  type StopType,
} from '../constants/travel'

interface StopEditorSheetProps {
  userId: string
  /** Day this stop belongs to (the default for a new stop / current for an edit). */
  dayId: string
  /** All days of the trip, for the "Move to day" picker. */
  days: { id: string; label: string }[]
  /** Existing stop to edit, or undefined to add a new one. */
  stop?: StopRow
  /** Trip base currency — the per-stop cost default (overridable). */
  defaultCurrency: string
  /** Type to preselect for a new stop (last-used). */
  defaultType?: StopType
  onClose: () => void
  onSaved: () => void
  /** Delete this stop (shown only when editing an existing stop). */
  onDelete?: () => void
}

const inputClass =
  'w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none'

type CompletionValue = '' | 'done' | 'skipped'
type ModeValue = '' | (typeof TRAVEL_MODES)[number]

/** A **local** overlay editing one stop (not a route sheet, so the Builder draft survives). */
export function StopEditorSheet({
  userId,
  dayId,
  days,
  stop,
  defaultCurrency,
  defaultType = 'visit',
  onClose,
  onSaved,
  onDelete,
}: StopEditorSheetProps) {
  useEscapeKey(onClose)
  const [saving, setSaving] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)

  const [type, setType] = useState<StopType>((stop?.type as StopType) ?? defaultType)
  const [targetDay, setTargetDay] = useState(stop?.trip_day_id ?? dayId)
  const [city, setCity] = useState(stop?.city ?? '')
  const [country, setCountry] = useState(stop?.country ?? '')
  const [province, setProvince] = useState(stop?.province ?? '')
  const [description, setDescription] = useState(stop?.description ?? '')
  const [details, setDetails] = useState(stop?.details ?? '')
  const [time, setTime] = useState(timeHHMM(stop?.time ?? null))
  const [cost, setCost] = useState(stop?.cost != null ? String(stop.cost) : '')
  const [costCurrency, setCostCurrency] = useState(stop?.cost_currency ?? defaultCurrency)
  const [localTransit, setLocalTransit] = useState(stop?.local_transit ?? '')
  const [travelMode, setTravelMode] = useState<ModeValue>(
    (stop?.travel_mode as ModeValue) ?? '',
  )
  const [fromLoc, setFromLoc] = useState(stop?.from_loc ?? '')
  const [toLoc, setToLoc] = useState(stop?.to_loc ?? '')
  const [completion, setCompletion] = useState<CompletionValue>(
    (stop?.completion as CompletionValue) ?? '',
  )

  function pickCity(resolved: ResolvedCity) {
    setCity(resolved.city)
    setCountry(resolved.country)
    setProvince(resolved.province ?? '')
    setCityOpen(false)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        trip_day_id: targetDay,
        type,
        city: city.trim() || null,
        country: country.trim() || null,
        province: province.trim() || null,
        description: description.trim() || null,
        details: details.trim() || null,
        time: time || null,
        cost: cost.trim() ? Number(cost) : null,
        cost_currency: cost.trim() ? costCurrency : null,
        local_transit: usesLocalTransit(type) ? localTransit.trim() || null : null,
        travel_mode: isTravelStop(type) ? travelMode || null : null,
        from_loc: isTravelStop(type) ? fromLoc.trim() || null : null,
        to_loc: isTravelStop(type) ? toLoc.trim() || null : null,
        completion: completion || null,
      }
      if (stop) {
        // Moving to a different day appends it there; same-day edits keep their position.
        const moved = targetDay !== stop.trip_day_id
        const sortPatch = moved ? { sort_order: await nextStopSortOrder(targetDay) } : {}
        await updateStop(stop.id, { ...payload, ...sortPatch })
      } else {
        const sort_order = await nextStopSortOrder(targetDay)
        await createStop({ ...payload, user_id: userId, sort_order })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={stop ? 'Edit stop' : 'Add stop'}
        className="absolute inset-0 flex flex-col bg-surface pt-[env(safe-area-inset-top)]"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={onClose} aria-label="Close" className="text-text-secondary">
            <IconX size={22} />
          </button>
          <h1 className="flex-1 text-[17px] font-medium text-text-primary">
            {stop ? 'Edit Stop' : 'Add Stop'}
          </h1>
          {stop && onDelete && (
            <button
              onClick={onDelete}
              aria-label="Delete stop"
              className="p-1 text-text-secondary"
            >
              <IconTrash size={20} />
            </button>
          )}
          <PrimaryButton size="sm" onClick={() => void save()} disabled={saving}>
            {stop ? 'Save' : 'Add'}
          </PrimaryButton>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <SegmentedTabs<StopType>
            value={type}
            onChange={setType}
            options={STOP_TYPES.map((t) => ({ value: t, label: STOP_TYPE_LABELS[t] }))}
          />

          {/* City */}
          <button
            onClick={() => setCityOpen(true)}
            className="flex items-center justify-between rounded-input bg-input px-3 py-2 text-left"
          >
            <span className="text-xs text-text-secondary">
              City
              <span className="mt-0.5 block text-[15px] text-text-primary">
                {city ? (
                  <>
                    {city}
                    <span className="text-text-secondary">
                      {[province, country].filter(Boolean).length
                        ? ` · ${[province, country].filter(Boolean).join(', ')}`
                        : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-text-tertiary">Pick a city</span>
                )}
              </span>
            </span>
            <IconChevronRight size={18} className="shrink-0 text-text-secondary" />
          </button>

          <label className="text-xs text-text-secondary">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'travel' ? 'Optional (uses From → To)' : 'Place / name'
              }
              className={`mt-1 ${inputClass}`}
            />
          </label>

          {/* Travel-only fields */}
          {isTravelStop(type) && (
            <div className="flex flex-col gap-3">
              <div className="text-xs text-text-secondary">
                Mode
                <div className="mt-1">
                  <SelectMenu<ModeValue>
                    value={travelMode}
                    onChange={setTravelMode}
                    ariaLabel="Travel mode"
                    options={[
                      { value: '', label: '—' },
                      ...TRAVEL_MODES.map((m) => ({
                        value: m,
                        label: TRAVEL_MODE_LABELS[m],
                      })),
                    ]}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <label className="flex-1 text-xs text-text-secondary">
                  From
                  <input
                    value={fromLoc}
                    onChange={(e) => setFromLoc(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="flex-1 text-xs text-text-secondary">
                  To
                  <input
                    value={toLoc}
                    onChange={(e) => setToLoc(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Visit-only field */}
          {usesLocalTransit(type) && (
            <label className="text-xs text-text-secondary">
              Local Transit
              <input
                value={localTransit}
                onChange={(e) => setLocalTransit(e.target.value)}
                placeholder="Metro exit, taxi, shuttle…"
                className={`mt-1 ${inputClass}`}
              />
            </label>
          )}

          <div className="flex gap-3">
            <label className="w-28 text-xs text-text-secondary">
              Time
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="flex-1 text-xs text-text-secondary">
              Cost
              <input
                type="number"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <div className="w-24 text-xs text-text-secondary">
              Currency
              <div className="mt-1">
                <SelectMenu
                  value={costCurrency}
                  onChange={setCostCurrency}
                  ariaLabel="Cost currency"
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                />
              </div>
            </div>
          </div>
          <p className="-mt-2 px-1 text-[11px] text-text-tertiary">
            Stop cost is informational only — it’s never summed into trip spend.
          </p>

          <label className="text-xs text-text-secondary">
            Details
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              className={`mt-1 resize-none ${inputClass}`}
            />
          </label>

          <div className="flex items-center gap-3">
            <div className="flex-1 text-xs text-text-secondary">
              Completion
              <div className="mt-1">
                <SelectMenu<CompletionValue>
                  value={completion}
                  onChange={setCompletion}
                  ariaLabel="Completion"
                  options={[
                    { value: '', label: 'Unmarked' },
                    { value: 'done', label: 'Done' },
                    { value: 'skipped', label: 'Skipped' },
                  ]}
                />
              </div>
            </div>
            {days.length > 1 && (
              <div className="flex-1 text-xs text-text-secondary">
                Day
                <div className="mt-1">
                  <SelectMenu
                    value={targetDay}
                    onChange={setTargetDay}
                    ariaLabel="Move to day"
                    options={days.map((d) => ({ value: d.id, label: d.label }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {cityOpen && (
        <CitySearchSheet
          userId={userId}
          initialQuery={city}
          onSelect={pickCity}
          onClose={() => setCityOpen(false)}
        />
      )}
    </div>
  )
}
