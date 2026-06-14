import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { IconX, IconPlus } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { EffortPicker } from '../components/EffortPicker'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { getActivity } from '../data/activity'
import { createEntry } from '../data/diary-entry'
import { createSets } from '../data/strength-set'
import { activityEnergyKcal, resolveMet } from '../lib/met'
import { draftAmount } from '../lib/quantity'
import { bumpDiary } from '../lib/diary-refresh'
import { todayLocal } from '../lib/date'
import type { Effort } from '../constants/effort-levels'

interface ExerciseDraft {
  name: string
  sets: { reps: number; weight: number }[]
}

export function ActivityLogSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { activityId = '' } = useParams()
  const [params] = useSearchParams()
  const day = params.get('day') ?? todayLocal()

  const { data: profile } = useProfile()
  const weightKg = profile?.weight_kg ?? 0

  const fn = useCallback(() => getActivity(activityId), [activityId])
  const { data: activity, loading, error } = useAsync(fn)

  const metMap = (activity?.met_by_effort ?? {}) as Record<string, number>
  const availableEfforts = Object.keys(metMap) as Effort[]

  const [effort, setEffort] = useState<Effort | null>(null)
  // Editable draft (string so it can be emptied on focus); resolves to the activity's default.
  const [minutes, setMinutes] = useState('')
  const [exercises, setExercises] = useState<ExerciseDraft[]>([
    { name: '', sets: [{ reps: 10, weight: 0 }] },
  ])
  const [saving, setSaving] = useState(false)

  const activityDefaultDuration = activity?.default_duration_min ?? 30
  // Prefill the Duration field from the activity's default once it loads.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activity) setMinutes(String(activity.default_duration_min))
  }, [activity])
  const minutesValue = draftAmount(minutes, activityDefaultDuration)

  // Effort defaults to the activity's, but is fully editable per session (e.g. an easier day).
  const defaultEffort = (activity?.default_effort as Effort) ?? 'moderate'
  const sessionEffort: Effort = effort ?? defaultEffort

  // Use the chosen effort's MET; fall back to the default-effort MET (always defined) when the
  // user picks a level this activity hasn't set a MET for.
  const met = resolveMet(metMap, sessionEffort) ?? resolveMet(metMap, defaultEffort) ?? 0
  const energy = activityEnergyKcal({ met, weightKg, minutes: minutesValue })

  function addSet(exIdx: number) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: [...ex.sets, { reps: 10, weight: 0 }] } : ex,
      ),
    )
  }
  function updateSet(
    exIdx: number,
    setIdx: number,
    field: 'reps' | 'weight',
    value: number,
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

  function resetToDefaults() {
    setEffort(null)
    setMinutes(String(activityDefaultDuration))
    setExercises([{ name: '', sets: [{ reps: 10, weight: 0 }] }])
  }

  async function addToDiary() {
    if (!activity || !userId) return
    setSaving(true)
    try {
      const entry = await createEntry({
        user_id: userId,
        day,
        group_name: 'activities',
        kind: 'activity',
        activity_id: activity.id,
        duration_min: minutesValue,
        effort: sessionEffort,
        energy_kcal: -Math.round(energy), // activities are negative
        label: activity.name,
        nutrients: {},
      })
      if (activity.template === 'strength') {
        const rows = exercises
          .filter((ex) => ex.name.trim())
          .flatMap((ex) =>
            ex.sets.map((s, i) => ({
              entry_id: entry.id,
              exercise: ex.name.trim(),
              set_number: i + 1,
              reps: s.reps,
              weight: s.weight,
              weight_unit: 'kg',
            })),
          )
        if (rows.length > 0) await createSets(rows)
      }
      bumpDiary()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet variant="full" label="Log activity">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="flex-1 truncate text-[17px] font-medium text-text-primary">
          {activity?.name ?? 'Activity'}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-sm text-text-secondary">Loading…</p>}
        {(error || (!loading && !activity)) && (
          <p className="text-sm text-danger">Couldn’t load this activity.</p>
        )}

        {activity && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs text-text-secondary">Effort Level</p>
              <EffortPicker
                value={sessionEffort}
                onChange={setEffort}
                available={availableEfforts}
              />
            </div>

            <label className="text-xs text-text-secondary">
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
                className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
              />
            </label>

            <div className="rounded-card border border-border bg-surface-alt px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[15px] text-text-primary">Energy Burned</span>
                <span className="text-[15px] font-medium text-accent">
                  −{Math.round(energy)} kcal
                </span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {met} MET × {weightKg} kg × {(minutesValue / 60).toFixed(2)} h
              </p>
            </div>

            {activity.template === 'strength' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-secondary">Exercises</p>
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
                      className="mb-2 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
                    />
                    {ex.sets.map((s, setIdx) => (
                      <div key={setIdx} className="mb-2 flex items-center gap-2">
                        <span className="w-10 text-xs text-text-secondary">
                          Set {setIdx + 1}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={s.reps}
                          onChange={(e) =>
                            updateSet(exIdx, setIdx, 'reps', Number(e.target.value) || 0)
                          }
                          className="w-16 rounded-input bg-input px-2 py-1.5 text-[13px] text-text-primary focus:outline-none"
                          aria-label="Reps"
                        />
                        <span className="text-xs text-text-tertiary">reps ×</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={s.weight}
                          onChange={(e) =>
                            updateSet(
                              exIdx,
                              setIdx,
                              'weight',
                              Number(e.target.value) || 0,
                            )
                          }
                          className="w-20 rounded-input bg-input px-2 py-1.5 text-[13px] text-text-primary focus:outline-none"
                          aria-label="Weight"
                        />
                        <span className="text-xs text-text-tertiary">kg</span>
                      </div>
                    ))}
                    <button
                      onClick={() => addSet(exIdx)}
                      className="text-xs text-positive"
                    >
                      + Add set
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setExercises((prev) => [
                      ...prev,
                      { name: '', sets: [{ reps: 10, weight: 0 }] },
                    ])
                  }
                  className="flex items-center gap-1 text-sm text-positive"
                >
                  <IconPlus size={16} /> Add exercise
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {activity && (
        <div className="flex gap-3 border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <button
            onClick={resetToDefaults}
            disabled={saving}
            className="rounded-pill border border-border px-5 py-3 text-sm font-medium text-text-secondary disabled:opacity-50"
          >
            RESET
          </button>
          <PrimaryButton
            onClick={() => void addToDiary()}
            disabled={saving}
            className="flex-1"
          >
            {saving ? 'Adding…' : 'ADD TO DIARY'}
          </PrimaryButton>
        </div>
      )}
    </Sheet>
  )
}
