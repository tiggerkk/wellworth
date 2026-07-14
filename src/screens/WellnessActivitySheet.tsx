import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { IconPlus } from '@tabler/icons-react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { EffortPicker } from '../components/EffortPicker'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useDirty } from '../hooks/useDirty'
import { useProfile } from '../hooks/useProfile'
import { useReturnAfterLog } from '../hooks/useReturnAfterLog'
import { getActivity } from '../data/activity'
import { createEntry, deleteEntry, getEntry, updateEntry } from '../data/diary-entry'
import { createSets, listSetsByEntry, replaceSets } from '../data/strength-set'
import { activityEnergyKcal, resolveMet } from '../lib/wellness-met'
import { draftAmount } from '../lib/wellness-quantity'
import { bumpDiary } from '../lib/wellness-diary-refresh'
import { todayLocal } from '../lib/date'
import type { Effort } from '../constants/wellness'

// reps/weight are string drafts (like Duration) so a field can be emptied while typing; they
// resolve to numbers only at save, where both must be > 0 (see strengthError).
interface SetDraft {
  reps: string
  weight: string
}
interface ExerciseDraft {
  name: string
  sets: SetDraft[]
}

// Empty defaults: an untouched set holds no data, so a still-unnamed exercise doesn't trip the
// "name your filled-in sets" error until the user actually types reps/weight.
const blankSet = (): SetDraft => ({ reps: '', weight: '' })
const blankExercises = (): ExerciseDraft[] => [{ name: '', sets: [blankSet()] }]

/** Rebuild the exercise editor's drafts from persisted strength_set rows (for editing). */
function groupSets(
  sets: { exercise: string; reps: number | null; weight: number | null }[],
): ExerciseDraft[] {
  const out: ExerciseDraft[] = []
  for (const s of sets) {
    let ex = out.find((e) => e.name === s.exercise)
    if (!ex) {
      ex = { name: s.exercise, sets: [] }
      out.push(ex)
    }
    ex.sets.push({
      reps: s.reps != null ? String(s.reps) : '',
      weight: s.weight != null ? String(Number(s.weight)) : '',
    })
  }
  return out.length > 0 ? out : blankExercises()
}

export function WellnessActivitySheet() {
  const navigate = useNavigate()
  const returnAfterLog = useReturnAfterLog()
  const { session } = useAuth()
  const userId = session?.user.id
  const { activityId = '' } = useParams()
  const [params] = useSearchParams()
  const day = params.get('day') ?? todayLocal()
  // When opened from a logged Diary row, `entry` is that diary_entry id → edit mode.
  const entryId = params.get('entry')
  const editing = entryId != null

  const { data: profile } = useProfile()
  const weightKg = profile?.weight_kg ?? 0

  const fn = useCallback(() => getActivity(activityId), [activityId])
  const { data: activity, loading, error } = useAsync(fn)

  const entryFn = useCallback(
    () => (entryId ? getEntry(entryId) : Promise.resolve(null)),
    [entryId],
  )
  const { data: entry } = useAsync(entryFn)
  const setsFn = useCallback(
    () => (entryId ? listSetsByEntry(entryId) : Promise.resolve([])),
    [entryId],
  )
  const { data: sets } = useAsync(setsFn)

  const metMap = (activity?.met_by_effort ?? {}) as Record<string, number>
  const availableEfforts = Object.keys(metMap) as Effort[]

  const [effort, setEffort] = useState<Effort | null>(null)
  // Editable draft (string so it can be emptied on focus); resolves to the activity's default.
  const [minutes, setMinutes] = useState('')
  const [exercises, setExercises] = useState<ExerciseDraft[]>(blankExercises)
  const [saving, setSaving] = useState(false)

  const activityDefaultDuration = activity?.default_duration_min ?? 30

  // Initialize once: add mode → the activity's defaults; edit mode → the entry's saved values.
  // Captured in `initial` to drive the dirty state + RESET.
  const [initial, setInitial] = useState<{
    minutes: string
    effort: Effort | null
    exercises: ExerciseDraft[]
  } | null>(null)
  useEffect(() => {
    if (!activity || initial) return
    if (editing && (!entry || !sets)) return
    const init =
      editing && entry
        ? {
            minutes: String(entry.duration_min ?? activity.default_duration_min),
            effort: (entry.effort as Effort | null) ?? null,
            exercises: groupSets(sets ?? []),
          }
        : {
            minutes: String(activity.default_duration_min),
            effort: null as Effort | null,
            exercises: blankExercises(),
          }
    /* eslint-disable react-hooks/set-state-in-effect */
    setMinutes(init.minutes)
    setEffort(init.effort)
    setExercises(init.exercises)
    setInitial(init)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activity, entry, sets, editing, initial])

  const minutesValue = draftAmount(minutes, activityDefaultDuration)
  const changed = useDirty({ minutes, effort, exercises }, initial)
  const dirty = initial != null && changed

  // Effort defaults to the activity's, but is fully editable per session (e.g. an easier day).
  const defaultEffort = (activity?.default_effort as Effort) ?? 'moderate'
  const sessionEffort: Effort = effort ?? defaultEffort

  // Use the chosen effort's MET; fall back to the default-effort MET (always defined) when the
  // user picks a level this activity hasn't set a MET for.
  const met = resolveMet(metMap, sessionEffort) ?? resolveMet(metMap, defaultEffort) ?? 0
  const energy = activityEnergyKcal({ met, weightKg, minutes: minutesValue })

  // Validate one exercise's draft (null = valid):
  //  - named   → every set needs reps > 0 and weight (kg) >= 0 (0 = bodyweight).
  //  - unnamed → fine if blank (dropped on save), but flag it if any set has data the user typed.
  function exerciseError(ex: ExerciseDraft): string | null {
    if (!ex.name.trim()) {
      const hasData = ex.sets.some((s) => s.reps.trim() !== '' || s.weight.trim() !== '')
      return hasData ? 'Enter a name for the exercise you’ve filled in.' : null
    }
    for (const s of ex.sets) {
      if (!(Number(s.reps) > 0)) return 'Reps must be greater than 0.'
      if (!(Number(s.weight) >= 0)) return 'Weight (kg) cannot be negative.'
    }
    return null
  }
  const strengthError =
    activity?.template === 'strength'
      ? (exercises.map(exerciseError).find((e) => e != null) ?? null)
      : null

  // Add set duplicates the previous row's reps + weight (a new set is usually the same load).
  function addSet(exIdx: number) {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex
        const last = ex.sets[ex.sets.length - 1] ?? blankSet()
        return { ...ex, sets: [...ex.sets, { ...last }] }
      }),
    )
  }
  function updateSet(
    exIdx: number,
    setIdx: number,
    field: 'reps' | 'weight',
    value: string,
  ) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)),
            }
          : ex,
      ),
    )
  }

  function reset() {
    if (!initial) return
    setMinutes(initial.minutes)
    setEffort(initial.effort)
    setExercises(
      initial.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) })),
    )
  }

  async function removeEntry() {
    if (!entryId) return
    setSaving(true)
    try {
      await deleteEntry(entryId)
      bumpDiary()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (!activity || !userId || strengthError) return
    setSaving(true)
    try {
      const energyKcal = -Math.round(energy) // activities are negative
      let targetEntryId: string
      if (editing && entryId) {
        await updateEntry(entryId, {
          duration_min: minutesValue,
          effort: sessionEffort,
          energy_kcal: energyKcal,
        })
        targetEntryId = entryId
      } else {
        const created = await createEntry({
          user_id: userId,
          day,
          group_name: 'activities',
          kind: 'activity',
          activity_id: activity.id,
          duration_min: minutesValue,
          effort: sessionEffort,
          energy_kcal: energyKcal,
          label: activity.name,
          nutrients: {},
        })
        targetEntryId = created.id
      }
      if (activity.template === 'strength') {
        const rows = exercises
          .filter((ex) => ex.name.trim())
          .flatMap((ex) =>
            ex.sets.map((s, i) => ({
              entry_id: targetEntryId,
              exercise: ex.name.trim(),
              set_number: i + 1,
              reps: Number(s.reps),
              weight: Number(s.weight),
              weight_unit: 'kg',
            })),
          )
        // Edit replaces the whole set list (handles removals); add just inserts.
        if (editing) await replaceSets(targetEntryId, rows)
        else if (rows.length > 0) await createSets(rows)
      }
      bumpDiary()
      returnAfterLog({ editing })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet variant="full" label="Log activity">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="line-clamp-2 flex-1 text-heading font-medium text-text-primary">
          {activity?.name ?? 'Activity'}
        </h1>
        {activity && (
          <EntryHeaderActions
            editing={editing}
            dirty={dirty}
            saving={saving}
            canSubmit={!strengthError}
            onReset={reset}
            onSubmit={() => void submit()}
            onDelete={editing && entryId ? () => void removeEntry() : undefined}
          />
        )}
      </header>
      {activity && strengthError && (
        <p className="border-b border-border bg-surface px-4 py-2 text-caption text-danger">
          {strengthError}
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-body text-text-secondary">Loading…</p>}
        {(error || (!loading && !activity)) && (
          <p className="text-body text-danger">Couldn’t load this activity.</p>
        )}

        {activity && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-caption text-text-secondary">Effort Level</p>
              <EffortPicker
                value={sessionEffort}
                onChange={setEffort}
                available={availableEfforts}
              />
            </div>

            <label className="text-caption text-text-secondary">
              Duration (minutes)
              <input
                type="number"
                min={0}
                step="any"
                value={minutes}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setMinutes(e.target.value)}
                onBlur={(e) => {
                  if (e.target.value.trim() === '')
                    setMinutes(String(activityDefaultDuration))
                }}
                className="mt-1 field-control no-spinner w-full"
              />
            </label>

            <div className="rounded-card border border-border bg-surface-alt px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-body text-text-primary">Energy Burned</span>
                <span className="text-body font-medium text-accent">
                  −{Math.round(energy)} kcal
                </span>
              </div>
              <p className="mt-1 text-caption text-text-secondary">
                {met} MET × {weightKg} kg × {(minutesValue / 60).toFixed(2)} h
              </p>
            </div>

            {activity.template === 'strength' && (
              <div className="flex flex-col gap-3">
                <p className="text-caption text-text-secondary">Exercises</p>
                {exercises.map((ex, exIdx) => (
                  <div
                    key={exIdx}
                    className="rounded-card border border-border bg-surface p-3"
                  >
                    <input
                      value={ex.name}
                      placeholder="Exercise name"
                      onChange={(e) =>
                        setExercises((prev) =>
                          prev.map((x, i) =>
                            i === exIdx ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                      className="mb-2 field-control w-full"
                    />
                    {ex.sets.map((s, setIdx) => (
                      <div key={setIdx} className="mb-2 flex items-center gap-2">
                        <span className="w-10 text-caption text-text-secondary">
                          Set {setIdx + 1}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={s.reps}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            updateSet(exIdx, setIdx, 'reps', e.target.value)
                          }
                          className="field-control no-spinner w-16"
                          aria-label="Reps"
                        />
                        <span className="text-caption text-text-tertiary">reps ×</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={s.weight}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            updateSet(exIdx, setIdx, 'weight', e.target.value)
                          }
                          className="field-control no-spinner w-20"
                          aria-label="Weight"
                        />
                        <span className="text-caption text-text-tertiary">kg</span>
                      </div>
                    ))}
                    <button
                      onClick={() => addSet(exIdx)}
                      className="text-caption text-positive"
                    >
                      + Add set
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setExercises((prev) => [...prev, { name: '', sets: [blankSet()] }])
                  }
                  className="flex items-center gap-1 text-body text-positive"
                >
                  <IconPlus size={16} /> Add exercise
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
