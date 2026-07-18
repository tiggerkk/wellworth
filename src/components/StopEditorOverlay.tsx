import { useState } from 'react'
import { IconWorldSearch } from '@tabler/icons-react'
import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { SegmentedTabs } from './SegmentedTabs'
import { SelectMenu } from './SelectMenu'
import { EntryHeaderActions } from './EntryHeaderActions'
import { ConfirmDialog } from './ConfirmDialog'
import { CitySearchOverlay } from './CitySearchOverlay'
import { createStop, nextStopSortOrder, updateStop } from '../data/travel'
import { type ResolvedCity, type StopRow } from '../lib/travel'
import { STOP_TYPES, STOP_TYPE_LABELS, type StopType } from '../constants/travel'
import { FIELD_CLASS as inputClass } from '../constants/forms'
import { useDiscardConfirm } from '../hooks/useDiscardConfirm'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface StopEditorOverlayProps {
  userId: string
  /** Day this stop belongs to (the default for a new stop / current for an edit). */
  dayId: string
  /** All days of the trip, for the "Move to day" picker. */
  days: { id: string; label: string }[]
  /** Existing stop to edit, or undefined to add a new one. */
  stop?: StopRow
  /** Type to preselect for a new stop (last-used). */
  defaultType?: StopType
  /** City/province/country carried forward from the previous stop (new stop only). */
  defaultCity?: string
  defaultCountry?: string
  defaultProvince?: string
  onClose: () => void
  /** Called with the created/updated row so the caller can merge it optimistically (no refetch). */
  onSaved: (stop: StopRow) => void
  /** Delete this stop (shown only when editing an existing stop). */
  onDelete?: () => void
}

type CompletionValue = '' | 'done' | 'skipped'

/** A **local** overlay editing one stop (not a route sheet, so the Builder draft survives). */
export function StopEditorOverlay({
  userId,
  dayId,
  days,
  stop,
  defaultType = 'visit',
  defaultCity = '',
  defaultCountry = '',
  defaultProvince = '',
  onClose,
  onSaved,
  onDelete,
}: StopEditorOverlayProps) {
  const [saving, setSaving] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)

  // The saved (or carried-forward) starting values — the baseline for dirty-check + Reset.
  const init = {
    type: (stop?.type as StopType) ?? defaultType,
    targetDay: stop?.trip_day_id ?? dayId,
    city: stop?.city ?? defaultCity,
    country: stop?.country ?? defaultCountry,
    province: stop?.province ?? defaultProvince,
    description: stop?.description ?? '',
    details: stop?.details ?? '',
    completion: (stop?.completion as CompletionValue) ?? '',
  }

  const [type, setType] = useState<StopType>(init.type)
  const [targetDay, setTargetDay] = useState(init.targetDay)
  const [city, setCity] = useState(init.city)
  const [country, setCountry] = useState(init.country)
  const [province, setProvince] = useState(init.province)
  const [description, setDescription] = useState(init.description)
  const [details, setDetails] = useState(init.details)
  const [completion, setCompletion] = useState<CompletionValue>(init.completion)

  const dirty =
    type !== init.type ||
    targetDay !== init.targetDay ||
    city !== init.city ||
    country !== init.country ||
    province !== init.province ||
    description !== init.description ||
    details !== init.details ||
    completion !== init.completion

  const { requestClose, confirm } = useDiscardConfirm(dirty, onClose)
  useEscapeKey(requestClose)

  function reset() {
    setType(init.type)
    setTargetDay(init.targetDay)
    setCity(init.city)
    setCountry(init.country)
    setProvince(init.province)
    setDescription(init.description)
    setDetails(init.details)
    setCompletion(init.completion)
  }

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
        completion: completion || null,
      }
      let saved: StopRow
      if (stop) {
        // Moving to a different day appends it there; same-day edits keep their position.
        const moved = targetDay !== stop.trip_day_id
        const sortPatch = moved ? { sort_order: await nextStopSortOrder(targetDay) } : {}
        await updateStop(stop.id, { ...payload, ...sortPatch })
        // The patch covers every edited field, so the merged row matches what the DB now holds.
        saved = { ...stop, ...payload, ...sortPatch }
      } else {
        const sort_order = await nextStopSortOrder(targetDay)
        saved = await createStop({ ...payload, user_id: userId, sort_order })
      }
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <OverlayTop onClose={requestClose} label={stop ? 'Edit stop' : 'Add stop'}>
        <ScreenHeaderTitle
          onClose={requestClose}
          title={stop ? 'Edit Stop' : 'Add Stop'}
          actions={
            <EntryHeaderActions
              editing={!!stop}
              dirty={dirty}
              saving={saving}
              onReset={reset}
              onSubmit={() => void save()}
              onDelete={stop && onDelete ? onDelete : undefined}
            />
          }
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <SegmentedTabs<StopType>
            value={type}
            onChange={setType}
            options={STOP_TYPES.map((t) => ({ value: t, label: STOP_TYPE_LABELS[t] }))}
          />

          {/* City — type it or look it up. */}
          <div>
            <div className="flex items-end gap-2">
              <label className="flex-1 text-caption text-text-secondary">
                City
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <button
                onClick={() => setCityOpen(true)}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-input bg-input px-3 py-2 text-body text-accent"
              >
                <IconWorldSearch size={16} /> Lookup
              </button>
            </div>
            <div className="mt-3 flex gap-3">
              <label className="flex-1 text-caption text-text-secondary">
                Province / Region
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="flex-1 text-caption text-text-secondary">
                Country
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </div>
          </div>

          <label className="text-caption text-text-secondary">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'travel' ? 'e.g. Train: Guangzhou → Chaozhou' : 'Place / name'
              }
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <label className="text-caption text-text-secondary">
            Details
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              className={`mt-1 resize-none ${inputClass}`}
            />
          </label>

          <div className="flex items-center gap-3">
            <div className="flex-1 text-caption text-text-secondary">
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
              <div className="flex-1 text-caption text-text-secondary">
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
      </OverlayTop>

      <ConfirmDialog
        open={confirm.open}
        title="Discard changes?"
        message="You have unsaved changes to this stop. Discard them?"
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />

      {cityOpen && (
        <CitySearchOverlay
          userId={userId}
          initialQuery={city}
          onSelect={pickCity}
          onClose={() => setCityOpen(false)}
        />
      )}
    </>
  )
}
