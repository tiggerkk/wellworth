import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { createActivity, getActivity, updateActivity } from '../data/activity'
import { draftAmount } from '../lib/quantity'
import { bumpDiary } from '../lib/diary-refresh'
import { EFFORT_LEVELS, type Effort } from '../constants/effort-levels'
import { ACTIVITY_ICONS, resolveActivityIcon } from '../constants/activity-icons'

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

export function NewActivitySheet() {
  const { id } = useParams()
  const isEdit = !!id

  const loadFn = useCallback(async (): Promise<ActivityInitial | null> => {
    if (!id) return BLANK
    const a = await getActivity(id)
    if (!a) return null
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
  }, [id])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <Sheet variant="full" label={isEdit ? 'Edit activity' : 'New activity'}>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {(error || (!loading && !initial)) && (
        <p className="p-4 text-sm text-danger">Couldn’t load this item.</p>
      )}
      {initial && <ActivityForm id={id} initial={initial} />}
    </Sheet>
  )
}

function ActivityForm({
  id,
  initial,
}: {
  id: string | undefined
  initial: ActivityInitial
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [template, setTemplate] = useState(initial.template)
  const [defaultEffort, setDefaultEffort] = useState<Effort>(initial.defaultEffort)
  const [defaultDuration, setDefaultDuration] = useState(initial.defaultDuration)
  const [met, setMet] = useState<Record<string, string>>(initial.met)
  const [icon, setIcon] = useState<string | null>(initial.icon)
  const [saving, setSaving] = useState(false)

  const hasMet = (k: Effort) => {
    const n = Number(met[k])
    return (met[k] ?? '').trim() !== '' && Number.isFinite(n) && n > 0
  }
  const anyMet = EFFORT_LEVELS.some((l) => hasMet(l.key))
  const defaultHasMet = hasMet(defaultEffort)
  // Require a MET for at least one level, and the chosen default must be one of them
  // (the Activity Log resolves energy from the default effort's MET).
  const canSave = name.trim() !== '' && anyMet && defaultHasMet
  const actionLabel = id ? 'SAVE' : 'CREATE'
  const busyLabel = id ? 'Saving…' : 'Adding…'

  // Dirty vs the loaded/blank initial — drives RESET + SAVE enablement.
  const dirty =
    JSON.stringify({
      name,
      description,
      template,
      defaultEffort,
      defaultDuration,
      met,
      icon,
    }) !== JSON.stringify(initial)

  function reset() {
    setName(initial.name)
    setDescription(initial.description)
    setTemplate(initial.template)
    setDefaultEffort(initial.defaultEffort)
    setDefaultDuration(initial.defaultDuration)
    setMet({ ...initial.met })
    setIcon(initial.icon)
  }

  async function save() {
    if (!userId || !canSave) return
    setSaving(true)
    try {
      const metByEffort: Record<string, number> = {}
      for (const [k, v] of Object.entries(met)) {
        const n = Number(v)
        if (v.trim() !== '' && Number.isFinite(n) && n > 0) metByEffort[k] = n
      }
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        template,
        default_effort: defaultEffort,
        default_duration_min: draftAmount(defaultDuration, 30),
        met_by_effort: metByEffort,
        icon,
      }
      if (id) await updateActivity(id, payload)
      else await createActivity({ user_id: userId, ...payload })
      bumpDiary()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="flex-1 truncate text-[17px] font-medium text-text-primary">
          {id ? 'Edit Activity' : 'New Activity'}
        </h1>
        <SecondaryButton size="sm" onClick={reset} disabled={!dirty || saving}>
          RESET
        </SecondaryButton>
        <PrimaryButton
          size="sm"
          onClick={() => void save()}
          disabled={saving || !canSave || (!!id && !dirty)}
        >
          {saving ? busyLabel : actionLabel}
        </PrimaryButton>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <label className="text-xs text-text-secondary">
          Activity Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
          />
        </label>

        <label className="text-xs text-text-secondary">
          Description (Optional)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
          />
        </label>

        <div>
          <p className="mb-1 text-xs text-text-secondary">Logging Template</p>
          <SegmentedTabs
            value={template}
            onChange={setTemplate}
            options={[
              { value: 'duration', label: 'Duration' },
              { value: 'strength', label: 'Strength' },
            ]}
          />
        </div>

        <label className="text-xs text-text-secondary">
          Default Duration (Minutes)
          <input
            type="number"
            min={0}
            step="any"
            value={defaultDuration}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDefaultDuration(e.target.value)}
            onBlur={(e) => {
              if (e.target.value.trim() === '') setDefaultDuration('30')
            }}
            className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
          />
        </label>

        {/* MET by effort + default effort selector */}
        <div>
          <p className="mb-1 text-xs text-text-secondary">
            MET by Effort (fill at least one level; the default effort must have a value)
          </p>
          <div className="flex flex-col gap-2">
            {EFFORT_LEVELS.map((level) => {
              const active = defaultEffort === level.key
              return (
                <div key={level.key} className="flex items-center gap-2">
                  <button
                    onClick={() => setDefaultEffort(level.key)}
                    className={`flex-1 rounded-input border px-3 py-2 text-left text-[15px] ${
                      active
                        ? 'border-accent bg-input text-text-primary'
                        : 'border-border bg-surface-alt text-text-secondary'
                    }`}
                  >
                    {level.label}{' '}
                    <span className="text-xs text-text-tertiary">{level.range}</span>
                    {active && (
                      <span className="ml-1 text-xs text-accent">· default</span>
                    )}
                  </button>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={met[level.key] ?? ''}
                    placeholder="MET"
                    onChange={(e) =>
                      setMet((prev) => ({ ...prev, [level.key]: e.target.value }))
                    }
                    className="w-20 rounded-input bg-input px-2 py-2 text-right text-[15px] text-text-primary focus:outline-none"
                  />
                </div>
              )
            })}
          </div>
          {anyMet && !defaultHasMet && (
            <p className="mt-1 text-xs text-danger">
              Set a MET for the default effort, or choose a default you’ve filled in.
            </p>
          )}
        </div>

        {/* Icon picker */}
        <div>
          <p className="mb-1 text-xs text-text-secondary">Icon</p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(ACTIVITY_ICONS).map((iconName) => {
              const Icon = resolveActivityIcon(iconName)
              const active = icon === iconName
              return (
                <button
                  key={iconName}
                  onClick={() => setIcon(iconName)}
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
