import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Sheet } from '../components/Sheet'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { useAuth } from '../auth/AuthProvider'
import { useDirty } from '../hooks/useDirty'
import { useEntryDraft } from '../hooks/useEntryDraft'
import { useEntryClose } from '../hooks/useEntryClose'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  createActivity,
  getActivity,
  softDeleteActivity,
  updateActivity,
} from '../data/activity'
import { draftAmount } from '../lib/wellness-quantity'
import { bumpDiary } from '../lib/wellness-diary-refresh'
import { routes } from '../constants/routes'
import { EFFORT_LEVELS, type Effort } from '../constants/wellness'
import {
  ACTIVITY_ICONS,
  ACTIVITY_TEMPLATES,
  resolveActivityIcon,
} from '../constants/wellness'
import { EntryLoader } from '../components/EntryLoader'
import type { Tables } from '../types/database'

interface ActivityInitial {
  name: string
  description: string
  template: string
  defaultEffort: Effort
  defaultDuration: string
  met: Record<string, string>
  icon: string | null
}

const BLANK: ActivityInitial = {
  name: '',
  description: '',
  template: 'duration',
  defaultEffort: 'moderate',
  defaultDuration: '30',
  met: {},
  icon: null,
}

function blankDraft(): ActivityInitial {
  return BLANK
}

/** Maps the fetched activity to the Edit form's draft shape. Module-level (stable identity) for
 *  `useEntryDraft`. */
function toDraft(a: Tables<'activity'>): ActivityInitial {
  const metMap = (a.met_by_effort ?? {}) as Record<string, number>
  const met: Record<string, string> = {}
  for (const [k, v] of Object.entries(metMap)) met[k] = String(v)
  return {
    name: a.name,
    description: a.description ?? '',
    template: a.template,
    defaultEffort: a.default_effort as Effort,
    defaultDuration: String(a.default_duration_min),
    met,
    icon: a.icon,
  }
}

/**
 * Activity — Entry / Edit. Outer loader + inner form keyed by id; `useEntryDraft` guarantees a
 * New-mode render never shows a previous edit's stale data (see its docstring).
 *
 * Close/Save navigation is fixed-destination (`useEntryClose`), not a history pop: Edit Activity's
 * Cancel/Save always return to the Library listing; New Activity's Cancel returns to wherever it
 * was opened from, and Save moves to the new activity's fixed Edit route. `dirty` is lifted from
 * `ActivityForm` (via `onDirtyChange`) since the close button lives in this outer, always-mounted
 * header.
 */
export function WellnessActivityEntry() {
  const { id } = useParams()

  const { initial, loading, error } = useEntryDraft({
    id,
    fetchRow: getActivity,
    toDraft,
    blank: blankDraft,
  })

  const [dirty, setDirty] = useState(false)
  const { requestClose, afterSave, confirm } = useEntryClose({
    editing: !!id,
    dirty,
    // Preserves the Activities tab on Cancel/Save — plain `routes.wellness.library` would reset
    // the Library to its default Foods tab.
    listing: `${routes.wellness.library}?tab=activities`,
    editRoute: routes.wellness.editActivity,
  })

  useEscapeKey(requestClose)

  return (
    <Sheet
      variant="full"
      label={id ? 'Edit Activity' : 'New Activity'}
      onClose={requestClose}
    >
      {/* This outer header is always mounted, so it displays "Loading" gracefully with the header
          structure perfectly intact. */}
      <ScreenHeaderTitle
        title={id ? 'Edit Activity' : 'New Activity'}
        icon={id ? 'back' : 'close'}
        onClose={requestClose}
        actions={<div className="w-24 shrink-0" />}
      />
      <EntryLoader
        loading={loading}
        error={error}
        data={initial}
        errorText="Couldn’t load this item."
      >
        {(d) => (
          <ActivityForm
            key={id ?? 'new'}
            id={id}
            initial={d}
            onDirtyChange={setDirty}
            afterSave={afterSave}
          />
        )}
      </EntryLoader>

      <ConfirmDialog
        open={confirm.open}
        title="Discard changes?"
        message="You have unsaved changes to this activity. Discard them?"
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </Sheet>
  )
}

function ActivityForm({
  id,
  initial,
  onDirtyChange,
  afterSave,
}: {
  id: string | undefined
  initial: ActivityInitial
  onDirtyChange: (dirty: boolean) => void
  afterSave: (newId: string, toastMessage?: string) => void
}) {
  const { session } = useAuth()
  const userId = session?.user.id

  const [draft, setDraft] = useState<ActivityInitial>(initial)
  const [saving, setSaving] = useState(false)

  const update = (patch: Partial<ActivityInitial>) =>
    setDraft((d) => ({ ...d, ...patch }))
  const dirty = useDirty(draft, initial)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const hasMet = (k: Effort) => {
    const n = Number(draft.met[k])
    return (draft.met[k] ?? '').trim() !== '' && Number.isFinite(n) && n > 0
  }
  const anyMet = EFFORT_LEVELS.some((l) => hasMet(l.key))
  const defaultHasMet = hasMet(draft.defaultEffort)
  // Require a MET for at least one level, and the chosen default must be one of them
  // (the Activity Log resolves energy from the default effort's MET).
  const canSave = draft.name.trim() !== '' && anyMet && defaultHasMet

  async function save() {
    if (!userId || !canSave) return
    setSaving(true)
    try {
      const metByEffort: Record<string, number> = {}
      for (const [k, v] of Object.entries(draft.met)) {
        const n = Number(v)
        if (v.trim() !== '' && Number.isFinite(n) && n > 0) metByEffort[k] = n
      }
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        template: draft.template,
        default_effort: draft.defaultEffort,
        default_duration_min: draftAmount(draft.defaultDuration, 30),
        met_by_effort: metByEffort,
        icon: draft.icon,
      }
      const newId = id ? id : (await createActivity({ user_id: userId, ...payload })).id
      if (id) await updateActivity(id, payload)
      bumpDiary()
      afterSave(newId, id ? 'Activity saved' : 'Activity added')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!id) return
    setSaving(true)
    try {
      await softDeleteActivity(id)
      bumpDiary()
      afterSave(id, 'Activity deleted')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="absolute top-3 right-4 z-10 flex items-center gap-3">
        <EntryHeaderActions
          editing={!!id}
          dirty={dirty}
          saving={saving}
          canSubmit={canSave}
          onReset={() => setDraft(initial)}
          onSubmit={() => void save()}
          onDelete={id ? () => void remove() : undefined}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <label className="text-caption text-text-secondary">
          Activity Name
          <input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-1 field-control w-full"
          />
        </label>

        <label className="text-caption text-text-secondary">
          Description (Optional)
          <input
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            className="mt-1 field-control w-full"
          />
        </label>

        <div>
          <p className="mb-1 text-caption text-text-secondary">Logging Template</p>
          <SegmentedTabs
            value={draft.template}
            onChange={(template) => update({ template })}
            options={ACTIVITY_TEMPLATES.map((t) => ({ value: t.key, label: t.label }))}
          />
        </div>

        <label className="text-caption text-text-secondary">
          Default Duration (Minutes)
          <input
            type="number"
            min={0}
            step="any"
            value={draft.defaultDuration}
            onFocus={(e) => e.target.select()}
            onChange={(e) => update({ defaultDuration: e.target.value })}
            onBlur={(e) => {
              if (e.target.value.trim() === '') update({ defaultDuration: '30' })
            }}
            className="mt-1 field-control no-spinner w-full"
          />
        </label>

        {/* MET by effort + default effort selector */}
        <div>
          <p className="mb-1 text-caption text-text-secondary">
            MET by Effort (fill at least one level; the default effort must have a value)
          </p>
          <div className="flex flex-col gap-2">
            {EFFORT_LEVELS.map((level) => {
              const active = draft.defaultEffort === level.key
              return (
                <div key={level.key} className="flex items-center gap-2">
                  <button
                    onClick={() => update({ defaultEffort: level.key })}
                    className={`flex-1 rounded-input border px-3 py-2 text-left text-body ${
                      active
                        ? 'border-accent bg-input text-text-primary'
                        : 'border-border bg-surface-alt text-text-secondary'
                    }`}
                  >
                    {level.label}{' '}
                    <span className="text-caption text-text-tertiary">{level.range}</span>
                    {active && (
                      <span className="ml-1 text-caption text-accent">· default</span>
                    )}
                  </button>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={draft.met[level.key] ?? ''}
                    placeholder="MET"
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        met: { ...d.met, [level.key]: e.target.value },
                      }))
                    }
                    className="field-control no-spinner w-20 text-right"
                  />
                </div>
              )
            })}
          </div>
          {anyMet && !defaultHasMet && (
            <p className="mt-1 text-caption text-danger">
              Set a MET for the default effort, or choose a default you’ve filled in.
            </p>
          )}
        </div>

        {/* Icon picker */}
        <div>
          <p className="mb-1 text-caption text-text-secondary">Icon</p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(ACTIVITY_ICONS).map((iconName) => {
              const Icon = resolveActivityIcon(iconName)
              const active = draft.icon === iconName
              return (
                <button
                  key={iconName}
                  onClick={() => update({ icon: iconName })}
                  aria-label={iconName}
                  className={`flex size-10 items-center justify-center rounded-input border ${
                    active
                      ? 'border-accent bg-input text-accent'
                      : 'border-border text-text-secondary'
                  }`}
                >
                  <Icon size={22} stroke={1.75} />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
