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
import { useDirty } from '../hooks/useDirty'
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

interface StopDraft {
  type: StopType
  targetDay: string
  city: string
  country: string
  province: string
  description: string
  details: string
  completion: CompletionValue
}

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
  const init: StopDraft = {
    type: (stop?.type as StopType) ?? defaultType,
    targetDay: stop?.trip_day_id ?? dayId,
    city: stop?.city ?? defaultCity,
    country: stop?.country ?? defaultCountry,
    province: stop?.province ?? defaultProvince,
    description: stop?.description ?? '',
    details: stop?.details ?? '',
    completion: (stop?.completion as CompletionValue) ?? '',
  }

  const [draft, setDraft] = useState<StopDraft>(init)
  const update = (patch: Partial<StopDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = useDirty(draft, init)

  const { requestClose, confirm } = useDiscardConfirm(dirty, onClose)
  useEscapeKey(requestClose)

  function pickCity(resolved: ResolvedCity) {
    update({
      city: resolved.city,
      country: resolved.country,
      province: resolved.province ?? '',
    })
    setCityOpen(false)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        trip_day_id: draft.targetDay,
        type: draft.type,
        city: draft.city.trim() || null,
        country: draft.country.trim() || null,
        province: draft.province.trim() || null,
        description: draft.description.trim() || null,
        details: draft.details.trim() || null,
        completion: draft.completion || null,
      }
      let saved: StopRow
      if (stop) {
        // Moving to a different day appends it there; same-day edits keep their position.
        const moved = draft.targetDay !== stop.trip_day_id
        const sortPatch = moved
          ? { sort_order: await nextStopSortOrder(draft.targetDay) }
          : {}
        await updateStop(stop.id, { ...payload, ...sortPatch })
        // The patch covers every edited field, so the merged row matches what the DB now holds.
        saved = { ...stop, ...payload, ...sortPatch }
      } else {
        const sort_order = await nextStopSortOrder(draft.targetDay)
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
              onReset={() => setDraft(init)}
              onSubmit={() => void save()}
              onDelete={stop && onDelete ? onDelete : undefined}
            />
          }
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <SegmentedTabs<StopType>
            value={draft.type}
            onChange={(type) => update({ type })}
            options={STOP_TYPES.map((t) => ({ value: t, label: STOP_TYPE_LABELS[t] }))}
          />

          {/* City — type it or look it up. */}
          <div>
            <div className="flex items-end gap-2">
              <label className="flex-1 text-caption text-text-secondary">
                City
                <input
                  value={draft.city}
                  onChange={(e) => update({ city: e.target.value })}
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
                  value={draft.province}
                  onChange={(e) => update({ province: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="flex-1 text-caption text-text-secondary">
                Country
                <input
                  value={draft.country}
                  onChange={(e) => update({ country: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </div>
          </div>

          <label className="text-caption text-text-secondary">
            Description
            <input
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder={
                draft.type === 'travel'
                  ? 'e.g. Train: Guangzhou → Chaozhou'
                  : 'Place / name'
              }
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <label className="text-caption text-text-secondary">
            Details
            <textarea
              value={draft.details}
              onChange={(e) => update({ details: e.target.value })}
              rows={2}
              className={`mt-1 resize-none ${inputClass}`}
            />
          </label>

          <div className="flex items-center gap-3">
            <div className="flex-1 text-caption text-text-secondary">
              Completion
              <div className="mt-1">
                <SelectMenu<CompletionValue>
                  value={draft.completion}
                  onChange={(completion) => update({ completion })}
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
                    value={draft.targetDay}
                    onChange={(targetDay) => update({ targetDay })}
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
          initialQuery={draft.city}
          onSelect={pickCity}
          onClose={() => setCityOpen(false)}
        />
      )}
    </>
  )
}
