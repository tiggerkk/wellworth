import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {
  IconHeart,
  IconHeartFilled,
  IconPlus,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { EntryLoader } from '../components/EntryLoader'
import { RemoveRowButton } from '../components/RemoveRowButton'
import { NutrientBar } from '../components/NutrientBar'
import { PrimaryButton } from '../components/PrimaryButton'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useDiscardConfirm } from '../hooks/useDiscardConfirm'
import { useProfile } from '../hooks/useProfile'
import { useReturnAfterLog } from '../hooks/useReturnAfterLog'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { createEntry, deleteEntry, getEntry, updateEntry } from '../data/diary-entry'
import {
  createFood,
  getFood,
  getFoodByExternal,
  setFavorite,
  updateFood,
} from '../data/food'
import {
  listServings,
  recomputeEntriesForServing,
  replaceServings,
  resolveDefaultServingId,
} from '../data/serving'
import type { Tables } from '../types/database'
import { getUsdaFood } from '../lib/wellness-food-api'
import { lookupBarcode } from '../lib/wellness-off-api'
import { asNutrientMap, isOverUpperLimit, scaledEntry } from '../lib/wellness-nutrients'
import { computeTargets } from '../lib/wellness-targets'
import { draftAmount } from '../lib/wellness-quantity'
import { bumpDiary } from '../lib/wellness-diary-refresh'
import { todayLocal } from '../lib/date'

interface Serving {
  /** Stored serving id, when this row came from the DB. Undefined for a not-yet-saved row (a
   *  freshly added serving, or the synthetic "100 g" fallback from `withDefaultServing`). */
  id?: string
  name: string
  grams: number
}

interface DetailFood {
  source: 'usda' | 'off' | 'custom'
  externalId: string | null
  localId: string | null
  name: string
  type: string
  nutrientBasis: string
  nutrients: ReturnType<typeof asNutrientMap>
  servings: Serving[]
  /** Index into `servings` of the preselected (default) measure. */
  defaultIndex: number
  isFavorite: boolean
}

/** Always offer a plain "100 g" measure unless the food already has one. */
function withDefaultServing(servings: Serving[]): Serving[] {
  return servings.some((s) => s.grams === 100)
    ? servings
    : [...servings, { name: '100 g', grams: 100 }]
}

/** Build the display serving list + the default's index from stored serving rows. */
function buildServings(
  rows: { id: string; name: string; grams: number }[],
  defaultServingId: string | null,
): { servings: Serving[]; defaultIndex: number } {
  // withDefaultServing only appends, so the stored rows keep their indices.
  const servings = withDefaultServing(
    rows.map((r) => ({ id: r.id, name: r.name, grams: r.grams })),
  )
  const found = rows.findIndex((r) => r.id === defaultServingId)
  return { servings, defaultIndex: found >= 0 ? found : 0 }
}

/**
 * Persist a food's servings + default, then bring any already-logged diary entries for a
 * gram-size change back in sync. `replaceServings` now updates existing rows in place (preserving
 * their id) rather than delete-and-reinsert, so `diary_entry.serving_id` stays valid across an
 * edit — that's what lets us recompute past entries instead of only affecting future ones.
 * Shared by the Manage-servings save and the seed-on-first-cache path (so a freshly
 * favorited/logged USDA food keeps its household serving, not just "100 g").
 * Returns the saved rows (with real ids) so a caller logging an entry in the same submit — e.g. a
 * brand-new serving added via "+ Add Serving" and logged against immediately — can resolve the
 * real `serving_id` instead of the pre-save `undefined`.
 */
async function writeServings(
  foodId: string,
  food: { nutrient_basis: string; nutrients: unknown },
  list: Serving[],
  defIndex: number,
): Promise<Tables<'serving'>[]> {
  const valid = list.filter((s) => s.name.trim() && s.grams > 0)
  const before = new Map(valid.filter((s) => s.id).map((s) => [s.id!, s.grams]))
  const saved = await replaceServings(
    foodId,
    valid.map((s) => ({ id: s.id, name: s.name.trim(), grams: s.grams })),
  )
  const def = list[defIndex]
  const pos = def ? valid.indexOf(def) : -1
  await updateFood(foodId, {
    default_serving_id: pos >= 0 ? resolveDefaultServingId(saved, { index: pos }) : null,
  })
  // Only servings that existed before AND changed grams need past entries recomputed — a brand
  // new serving or an unchanged one has nothing logged against it yet (or nothing to update).
  const changed = saved.filter((s) => {
    const prevGrams = before.get(s.id)
    return prevGrams != null && prevGrams !== s.grams
  })
  await Promise.all(changed.map((s) => recomputeEntriesForServing(s.id, food, s.grams)))
  return saved
}

export function WellnessDiaryFoodDetailSheet() {
  const navigate = useNavigate()
  const returnAfterLog = useReturnAfterLog()
  const { session } = useAuth()
  const userId = session?.user.id
  const { source = 'usda', id = '' } = useParams()
  const [params] = useSearchParams()
  const group = params.get('group') ?? 'snacks'
  const day = params.get('day') ?? todayLocal()
  // When opened from a logged Diary row, `entry` is that diary_entry id → edit mode.
  const entryId = params.get('entry')
  const editing = entryId != null
  // Opened from the Library to manage a cached USDA/OFF food's servings, not to log it — the
  // Amount field and diary create/update are irrelevant here; Save only persists servings/default.
  const managing = params.get('mode') === 'manage'

  const { data: profile } = useProfile()
  const { byKey, nutrients: nutrientRows } = useNutrientReference()

  const loadFn = useCallback(async (): Promise<DetailFood | null> => {
    // USDA/OFF foods: prefer a previously-cached `food` row (favorited/logged/customized) so its
    // stored servings + default + favorite state come back. Only fall back to the live API when
    // the food was never saved.
    if (source === 'usda' || source === 'off') {
      const cached = await getFoodByExternal(source, id)
      if (cached) {
        const rows = await listServings(cached.id)
        const { servings, defaultIndex } = buildServings(
          rows.map((s) => ({ id: s.id, name: s.name, grams: Number(s.grams) })),
          cached.default_serving_id,
        )
        return {
          source,
          externalId: id,
          localId: cached.id,
          name: cached.name,
          type: cached.type,
          nutrientBasis: cached.nutrient_basis,
          nutrients: asNutrientMap(cached.nutrients),
          servings,
          defaultIndex,
          isFavorite: cached.is_favorite,
        }
      }
      const f = source === 'usda' ? await getUsdaFood(id) : await lookupBarcode(id)
      if (!f) return null
      const seeded = f.servingGrams
        ? [{ name: f.servingText ?? '1 serving', grams: f.servingGrams }]
        : []
      return {
        source,
        externalId: id,
        localId: null,
        name: f.name,
        type: 'food',
        nutrientBasis: 'per_100g',
        nutrients: f.nutrients,
        servings: withDefaultServing(seeded),
        defaultIndex: 0,
        isFavorite: false,
      }
    }
    const [row, rows] = await Promise.all([getFood(id), listServings(id)])
    if (!row) return null
    const { servings, defaultIndex } = buildServings(
      rows.map((s) => ({ id: s.id, name: s.name, grams: Number(s.grams) })),
      row.default_serving_id,
    )
    return {
      source: row.source as DetailFood['source'],
      externalId: row.external_id,
      localId: row.id,
      name: row.name,
      type: row.type,
      nutrientBasis: row.nutrient_basis,
      nutrients: asNutrientMap(row.nutrients),
      servings,
      defaultIndex,
      isFavorite: row.is_favorite,
    }
  }, [source, id])

  const { data: food, loading, error } = useAsync(loadFn)

  const entryFn = useCallback(
    () => (entryId ? getEntry(entryId) : Promise.resolve(null)),
    [entryId],
  )
  const { data: entry } = useAsync(entryFn)

  // Editable draft (string so it can be emptied on focus); resolves to 1 when left blank.
  const [amount, setAmount] = useState('1')
  const [servingIndex, setServingIndex] = useState(0)
  // Managed serving list (name + grams) + which one is the food's default. Seeded from `food`
  // once it loads; only an explicit edit here writes back to the DB — see `servingsDirty`.
  const [servings, setServings] = useState<Serving[]>([])
  const [defaultIndex, setDefaultIndex] = useState(0)
  const [manageOpen, setManageOpen] = useState(managing)
  // Snapshot of the loaded servings + default, for dirty-tracking + RESET.
  const [servingsInitial, setServingsInitial] = useState<{
    servings: Serving[]
    defaultIndex: number
  } | null>(null)
  // null = follow the loaded value; once toggled, this override drives the heart both ways.
  const [favOverride, setFavOverride] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  // Edit mode: the entry's saved amount/serving, captured once to drive dirty + RESET.
  const [initial, setInitial] = useState<{
    amount: string
    servingIndex: number
  } | null>(null)

  // Seed the serving state once `food` resolves (before the snapshot exists, fall back to the
  // freshly-loaded list so the dropdown/summary render without a blank frame).
  useEffect(() => {
    if (!food || servingsInitial) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setServings(food.servings)
    setDefaultIndex(food.defaultIndex)
    setServingsInitial({ servings: food.servings, defaultIndex: food.defaultIndex })
    if (!editing) setServingIndex(food.defaultIndex)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [food, servingsInitial, editing])

  const effectiveServings = servingsInitial ? servings : (food?.servings ?? [])
  const serving = effectiveServings[servingIndex] ?? effectiveServings[0]
  const scaled = useMemo(() => {
    if (!food || !serving) return {}
    return scaledEntry(
      food.nutrients,
      food.nutrientBasis,
      draftAmount(amount, 1),
      serving.grams,
    )
  }, [food, serving, amount])

  // On edit, prefill from the entry once food + entry load. `entry.serving_id` is now recorded at
  // log time (see writeServings/submit), so prefer an exact id match; the energy-match heuristic
  // remains only as a fallback for entries logged before this was tracked, or whose serving was
  // since deleted (serving_id NULL via ON DELETE SET NULL).
  useEffect(() => {
    if (!editing || !food || !entry || initial) return
    const byId = entry.serving_id
      ? food.servings.findIndex((s) => s.id === entry.serving_id)
      : -1
    let bestIndex = byId
    if (bestIndex < 0) {
      bestIndex = 0
      let bestDiff = Infinity
      food.servings.forEach((s, i) => {
        const e =
          scaledEntry(food.nutrients, food.nutrientBasis, entry.amount ?? 1, s.grams)
            .energy ?? 0
        const diff = Math.abs(e - (entry.energy_kcal ?? 0))
        if (diff < bestDiff) {
          bestDiff = diff
          bestIndex = i
        }
      })
    }
    const amt = String(entry.amount ?? 1)
    /* eslint-disable react-hooks/set-state-in-effect */
    setAmount(amt)
    setServingIndex(bestIndex)
    setInitial({ amount: amt, servingIndex: bestIndex })
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editing, food, entry, initial])

  const servingsDirty =
    servingsInitial != null &&
    JSON.stringify({ servings, defaultIndex }) !==
      JSON.stringify({
        servings: servingsInitial.servings,
        defaultIndex: servingsInitial.defaultIndex,
      })

  const dirty = managing
    ? servingsDirty
    : (initial != null &&
        (amount !== initial.amount || servingIndex !== initial.servingIndex)) ||
      servingsDirty

  const close = () => navigate(-1)
  const { requestClose, confirm } = useDiscardConfirm(dirty, close)

  function reset() {
    if (initial) {
      setAmount(initial.amount)
      setServingIndex(initial.servingIndex)
    }
    if (servingsInitial) {
      setServings(servingsInitial.servings)
      setDefaultIndex(servingsInitial.defaultIndex)
    }
  }

  function updateServing(i: number, patch: Partial<Serving>) {
    setServings((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }
  function addServing() {
    setManageOpen(true)
    setServings((prev) => [...prev, { name: '', grams: 0 }])
  }
  function deleteServingAt(i: number) {
    setServings((prev) => prev.filter((_, j) => j !== i))
    setDefaultIndex((d) => (d === i ? 0 : d > i ? d - 1 : d))
    setServingIndex((s) => (s === i ? 0 : s > i ? s - 1 : s))
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

  const targets = profile ? computeTargets(profile) : null
  const favShown = favOverride ?? food?.isFavorite ?? false

  async function ensureCachedId(
    f: DetailFood,
  ): Promise<{ foodId: string; seeded: Tables<'serving'>[] | null }> {
    if (f.localId) return { foodId: f.localId, seeded: null }
    if (f.externalId) {
      const existing = await getFoodByExternal(f.source, f.externalId)
      if (existing) return { foodId: existing.id, seeded: null }
    }
    const created = await createFood({
      user_id: userId!,
      source: f.source,
      external_id: f.externalId,
      name: f.name,
      type: f.type,
      nutrient_basis: 'per_100g',
      nutrients: f.nutrients,
      is_favorite: favShown,
    })
    // Seed the food's servings (incl. its USDA/OFF household serving) on first cache, so reopening it
    // shows more than "100 g". Skip when the Manage list is dirty — persistServings writes the edited
    // list right after, which would otherwise double-write.
    let seeded: Tables<'serving'>[] | null = null
    if (!servingsDirty) {
      seeded = await writeServings(
        created.id,
        { nutrient_basis: 'per_100g', nutrients: f.nutrients },
        f.servings,
        f.defaultIndex,
      )
    }
    return { foodId: created.id, seeded }
  }

  // Persist the managed servings + default — only when the user actually changed them. Returns
  // the saved rows so a caller logging an entry in this same submit can resolve a just-added
  // serving's real id (it has none yet in local state).
  async function persistServings(foodId: string): Promise<Tables<'serving'>[] | null> {
    if (!servingsDirty || !food) return null
    const saved = await writeServings(
      foodId,
      { nutrient_basis: food.nutrientBasis, nutrients: food.nutrients },
      servings,
      defaultIndex,
    )
    setServingsInitial({ servings, defaultIndex })
    return saved
  }

  async function submit() {
    if (!food || !userId || !serving) return
    setSaving(true)
    try {
      const { foodId, seeded } = await ensureCachedId(food)
      const saved = await persistServings(foodId)
      if (managing) {
        bumpDiary()
        navigate(-1)
        return
      }
      // `serving.id` is undefined for a serving that only just got its real id this submit — a
      // brand-new USDA/OFF food's seeded household serving (`seeded`, from `ensureCachedId`), or a
      // serving added via "+ Add Serving" in Manage Servings (`saved`, from `persistServings`).
      // Resolve it by matching what was actually saved, since local state never got the new id.
      const resolved = (seeded ?? saved)?.find(
        (s) => s.name === serving.name.trim() && s.grams === serving.grams,
      )
      const servingId = serving.id ?? resolved?.id ?? null
      if (editing && entryId) {
        await updateEntry(entryId, {
          amount: draftAmount(amount, 1),
          serving_id: servingId,
          energy_kcal: scaled.energy ?? 0,
          nutrients: scaled,
        })
      } else {
        await createEntry({
          user_id: userId,
          day,
          group_name: group,
          kind: 'food',
          food_id: foodId,
          amount: draftAmount(amount, 1),
          serving_id: servingId,
          energy_kcal: scaled.energy ?? 0,
          label: food.name,
          nutrients: scaled,
        })
      }
      bumpDiary()
      returnAfterLog({ editing })
    } finally {
      setSaving(false)
    }
  }

  async function toggleFavorite() {
    if (!food) return
    const next = !favShown
    setFavOverride(next)
    const { foodId } = await ensureCachedId(food)
    await persistServings(foodId)
    await setFavorite(foodId, next)
  }

  // Nutrients to show in the summary, in reference order, that have a value.
  const summaryKeys = (nutrientRows ?? [])
    .map((n) => n.key)
    .filter((k) => (scaled[k] ?? 0) > 0)

  return (
    <Sheet variant="full" label="Food detail" onClose={requestClose}>
      {/* Header always mounted (no shift once the food loads) — actions are reserved space here,
          then absolutely floated over that same space once loaded below. */}
      <ScreenHeaderTitle
        title={food?.name ?? 'Food Detail'}
        titleClassName="line-clamp-2 flex-1 text-heading font-medium text-text-primary"
        icon="back"
        onClose={requestClose}
        actions={<div className="w-36 shrink-0" />}
      />

      <EntryLoader
        loading={loading}
        error={error}
        data={food && serving ? { food, serving } : null}
        errorText="Couldn’t load this item."
      >
        {() => (
          <>
            <div className="absolute top-3 right-4 z-10 flex items-center gap-3">
              <button onClick={() => void toggleFavorite()} aria-label="Favorite">
                {favShown ? (
                  <IconHeartFilled size={20} className="text-favorite" />
                ) : (
                  <IconHeart size={20} className="text-text-tertiary" />
                )}
              </button>
              {editing ? (
                <EntryHeaderActions
                  editing
                  dirty={dirty}
                  saving={saving}
                  onReset={reset}
                  onSubmit={() => void submit()}
                  onDelete={entryId ? () => void removeEntry() : undefined}
                />
              ) : managing ? (
                <EntryHeaderActions
                  editing
                  dirty={dirty}
                  saving={saving}
                  onReset={reset}
                  onSubmit={() => void submit()}
                />
              ) : (
                <PrimaryButton
                  size="sm"
                  tone="positive"
                  onClick={() => void submit()}
                  disabled={saving}
                  aria-label="Add to diary"
                >
                  <IconPlus size={18} />
                </PrimaryButton>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-2 flex gap-3">
                {!managing && (
                  <label className="w-16 shrink-0 text-caption text-text-secondary">
                    Amount
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={amount}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setAmount(e.target.value)}
                      onBlur={(e) => {
                        if (e.target.value.trim() === '') setAmount('1')
                      }}
                      className="mt-1 field-control no-spinner w-full"
                    />
                  </label>
                )}
                <label className="min-w-0 flex-1 text-caption text-text-secondary">
                  Serving Size
                  <select
                    value={servingIndex}
                    onChange={(e) => setServingIndex(Number(e.target.value))}
                    className="mt-1 field-control w-full"
                  >
                    {effectiveServings.map((sv, i) => (
                      <option key={i} value={i}>
                        {sv.name} ({sv.grams} g){i === defaultIndex ? ' · default' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Manage servings: add/edit/delete custom measures + pick the default. These are the
                  food's reusable measures (persisted on ADD/heart/SAVE); the Amount above is the
                  per-log quantity and never changes them. In `manage` mode this panel is the whole
                  point of the screen, so it's always shown with no toggle. */}
              {!managing && (
                <button
                  onClick={() => setManageOpen((o) => !o)}
                  className="mb-4 text-body text-accent"
                >
                  {manageOpen ? 'Hide Servings' : 'Manage Servings'}
                </button>
              )}
              {(managing || manageOpen) && (
                <div className="mb-4 flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
                  {servings.map((sv, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        onClick={() => setDefaultIndex(i)}
                        aria-label={
                          i === defaultIndex ? 'Default serving' : 'Set as default'
                        }
                        title="Set as default"
                        className="shrink-0"
                      >
                        {i === defaultIndex ? (
                          <IconStarFilled size={18} className="text-favorite" />
                        ) : (
                          <IconStar size={18} className="text-text-tertiary" />
                        )}
                      </button>
                      <input
                        value={sv.name}
                        placeholder="e.g. 1 cup"
                        onChange={(e) => updateServing(i, { name: e.target.value })}
                        className="field-control flex-1"
                      />
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={sv.grams || ''}
                        placeholder="g"
                        onChange={(e) =>
                          updateServing(i, { grams: Number(e.target.value) })
                        }
                        onFocus={(e) => e.target.select()}
                        className="field-control w-20"
                      />
                      <RemoveRowButton
                        onClick={() => deleteServingAt(i)}
                        label="Remove serving"
                      />
                    </div>
                  ))}
                  <button
                    onClick={addServing}
                    className="flex items-center gap-1 text-body text-positive"
                  >
                    <IconPlus size={16} /> Add Serving
                  </button>
                </div>
              )}

              <h2 className="mb-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
                Complete Nutrient Summary
              </h2>
              <div className="rounded-card border border-border bg-surface px-4 py-1">
                {summaryKeys.length === 0 && (
                  <p className="py-3 text-body text-text-tertiary">No nutrient data.</p>
                )}
                {summaryKeys.map((key) => {
                  const ref = byKey.get(key)
                  const dri = targets?.dri[key]
                  const value = scaled[key] ?? 0
                  return (
                    <NutrientBar
                      key={key}
                      label={ref?.display_name ?? key}
                      value={value}
                      target={dri?.target ?? null}
                      unit={ref?.unit ?? ''}
                      over={dri ? isOverUpperLimit(value, dri) : false}
                    />
                  )
                })}
              </div>
            </div>
          </>
        )}
      </EntryLoader>

      <ConfirmDialog
        open={confirm.open}
        title="Discard changes?"
        message="You have unsaved changes here. Discard them?"
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </Sheet>
  )
}
