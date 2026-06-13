import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { createActivity, getActivity, updateActivity } from '../data/activity'
import { bumpDiary } from '../lib/diary-refresh'
import { EFFORT_LEVELS, type Effort } from '../constants/effort-levels'
import { ACTIVITY_ICONS, resolveActivityIcon } from '../constants/activity-icons'

interface ActivityInitial {
  name: string
  description: string
  template: string
  defaultEffort: Effort
  met: Record<string, string>
  icon: string | null
}

const BLANK: ActivityInitial = {
  name: '',
  description: '',
  template: 'duration',
  defaultEffort: 'moderate',
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
  const [met, setMet] = useState<Record<string, string>>(initial.met)
  const [icon, setIcon] = useState<string | null>(initial.icon)
  const [saving, setSaving] = useState(false)

  const defaultMet = Number(met[defaultEffort])
  const canSave = name.trim() !== '' && Number.isFinite(defaultMet) && defaultMet > 0

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
        <h1 className="flex-1 text-[17px] font-medium text-text-primary">
          {id ? 'Edit Activity' : 'New Activity'}
        </h1>
        <button
          onClick={() => void save()}
          disabled={saving || !canSave}
          className="text-[15px] font-medium text-accent disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
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
          Description (optional)
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

        {/* MET by effort + default effort selector */}
        <div>
          <p className="mb-1 text-xs text-text-secondary">
            MET by effort (select the default, fill at least its value)
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
