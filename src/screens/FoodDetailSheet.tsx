import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { IconHeart, IconHeartFilled, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { NutrientBar } from '../components/NutrientBar'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useReturnAfterLog } from '../hooks/useReturnAfterLog'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { createEntry, getEntry, updateEntry } from '../data/diary-entry'
import { createFood, getFood, getFoodByExternal, setFavorite } from '../data/food'
import { listServings } from '../data/serving'
import { getUsdaFood } from '../lib/food-api'
import { lookupBarcode } from '../lib/off-api'
import {
  asNutrientMap,
  basisGrams,
  deriveNetCarbs,
  isOverUpperLimit,
  scaleNutrients,
} from '../lib/nutrients'
import { computeTargets } from '../lib/targets'
import { draftAmount } from '../lib/quantity'
import { bumpDiary } from '../lib/diary-refresh'
import { todayLocal } from '../lib/date'

interface DetailFood {
  source: 'usda' | 'off' | 'custom'
  externalId: string | null
  localId: string | null
  name: string
  type: string
  nutrientBasis: string
  nutrients: ReturnType<typeof asNutrientMap>
  servings: { name: string; grams: number }[]
  isFavorite: boolean
}

function withDefaultServing(servings: { name: string; grams: number }[]) {
  return servings.some((s) => s.grams === 100)
    ? servings
    : [...servings, { name: '100 g', grams: 100 }]
}

export function FoodDetailSheet() {
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

  const { data: profile } = useProfile()
  const { byKey, nutrients: nutrientRows } = useNutrientReference()

  const loadFn = useCallback(async (): Promise<DetailFood | null> => {
    if (source === 'usda') {
      const f = await getUsdaFood(id)
      return {
        source: 'usda',
        externalId: id,
        localId: null,
        name: f.name,
        type: 'food',
        nutrientBasis: 'per_100g',
        nutrients: f.nutrients,
        servings: withDefaultServing(
          f.servingGrams
            ? [{ name: f.servingText ?? '1 serving', grams: f.servingGrams }]
            : [],
        ),
        isFavorite: false,
      }
    }
    if (source === 'off') {
      const f = await lookupBarcode(id)
      if (!f) return null
      return {
        source: 'off',
        externalId: id,
        localId: null,
        name: f.name,
        type: 'food',
        nutrientBasis: 'per_100g',
        nutrients: f.nutrients,
        servings: withDefaultServing(
          f.servingGrams
            ? [{ name: f.servingText ?? '1 serving', grams: f.servingGrams }]
            : [],
        ),
        isFavorite: false,
      }
    }
    const row = await getFood(id)
    if (!row) return null
    const servings = await listServings(id)
    return {
      source: row.source as DetailFood['source'],
      externalId: row.external_id,
      localId: row.id,
      name: row.name,
      type: row.type,
      nutrientBasis: row.nutrient_basis,
      nutrients: asNutrientMap(row.nutrients),
      servings: withDefaultServing(
        servings.map((s) => ({ name: s.name, grams: Number(s.grams) })),
      ),
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
  // null = follow the loaded value; once toggled, this override drives the heart both ways.
  const [favOverride, setFavOverride] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  // Edit mode: the entry's saved amount/serving, captured once to drive dirty + RESET.
  const [initial, setInitial] = useState<{
    amount: string
    servingIndex: number
  } | null>(null)

  const serving = food?.servings[servingIndex] ?? food?.servings[0]
  const scaled = useMemo(() => {
    if (!food || !serving) return {}
    const basis = food.nutrientBasis === 'per_serving' ? serving.grams : 100
    return deriveNetCarbs(
      scaleNutrients(food.nutrients, {
        amount: draftAmount(amount, 1),
        servingGrams: serving.grams,
        basisGrams: basis,
      }),
    )
  }, [food, serving, amount])

  // On edit, prefill from the entry once food + entry load. Entries don't persist which serving
  // was used, so pick the serving whose scaled energy best matches the logged energy.
  useEffect(() => {
    if (!editing || !food || !entry || initial) return
    let bestIndex = 0
    let bestDiff = Infinity
    food.servings.forEach((s, i) => {
      const e =
        scaleNutrients(food.nutrients, {
          amount: entry.amount ?? 1,
          servingGrams: s.grams,
          basisGrams: basisGrams(food.nutrientBasis, s.grams),
        }).energy ?? 0
      const diff = Math.abs(e - (entry.energy_kcal ?? 0))
      if (diff < bestDiff) {
        bestDiff = diff
        bestIndex = i
      }
    })
    const amt = String(entry.amount ?? 1)
    /* eslint-disable react-hooks/set-state-in-effect */
    setAmount(amt)
    setServingIndex(bestIndex)
    setInitial({ amount: amt, servingIndex: bestIndex })
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editing, food, entry, initial])

  const dirty =
    initial != null &&
    (amount !== initial.amount || servingIndex !== initial.servingIndex)

  function reset() {
    if (!initial) return
    setAmount(initial.amount)
    setServingIndex(initial.servingIndex)
  }

  const targets = profile ? computeTargets(profile) : null
  const favShown = favOverride ?? food?.isFavorite ?? false

  async function ensureCachedId(f: DetailFood): Promise<string> {
    if (f.localId) return f.localId
    if (f.externalId) {
      const existing = await getFoodByExternal(f.source, f.externalId)
      if (existing) return existing.id
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
    return created.id
  }

  async function submit() {
    if (!food || !userId || !serving) return
    setSaving(true)
    try {
      if (editing && entryId) {
        await updateEntry(entryId, {
          amount: draftAmount(amount, 1),
          energy_kcal: scaled.energy ?? 0,
          nutrients: scaled,
        })
      } else {
        const foodId = await ensureCachedId(food)
        await createEntry({
          user_id: userId,
          day,
          group_name: group,
          kind: 'food',
          food_id: foodId,
          amount: draftAmount(amount, 1),
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
    const foodId = await ensureCachedId(food)
    await setFavorite(foodId, next)
  }

  // Nutrients to show in the summary, in reference order, that have a value.
  const summaryKeys = (nutrientRows ?? [])
    .map((n) => n.key)
    .filter((k) => (scaled[k] ?? 0) > 0)

  return (
    <Sheet variant="full" label="Food detail">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="flex-1 truncate text-[17px] font-medium text-text-primary">
          {food?.name ?? 'Food'}
        </h1>
        {food && (
          <button onClick={() => void toggleFavorite()} aria-label="Favorite">
            {favShown ? (
              <IconHeartFilled size={20} className="text-accent" />
            ) : (
              <IconHeart size={20} className="text-text-tertiary" />
            )}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-sm text-text-secondary">Loading…</p>}
        {(error || (!loading && !food)) && (
          <p className="text-sm text-danger">Couldn’t load this item.</p>
        )}

        {food && serving && (
          <>
            <div className="mb-4 flex gap-3">
              <label className="flex-1 text-xs text-text-secondary">
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
                  className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
                />
              </label>
              <label className="flex-1 text-xs text-text-secondary">
                Serving Size
                <select
                  value={servingIndex}
                  onChange={(e) => setServingIndex(Number(e.target.value))}
                  className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
                >
                  {food.servings.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} ({s.grams} g)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <h2 className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
              Complete Nutrient Summary
            </h2>
            <div className="rounded-card border border-border bg-surface px-4 py-1">
              {summaryKeys.length === 0 && (
                <p className="py-3 text-sm text-text-tertiary">No nutrient data.</p>
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
          </>
        )}
      </div>

      {food && (
        <div className="flex gap-3 border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {editing ? (
            <>
              <SecondaryButton onClick={reset} disabled={!dirty || saving}>
                RESET
              </SecondaryButton>
              <PrimaryButton
                onClick={() => void submit()}
                disabled={!dirty || saving}
                className="flex-1"
              >
                {saving ? 'Saving…' : 'SAVE'}
              </PrimaryButton>
            </>
          ) : (
            <PrimaryButton
              onClick={() => void submit()}
              disabled={saving}
              className="w-full"
            >
              {saving ? 'Adding…' : 'ADD TO DIARY'}
            </PrimaryButton>
          )}
        </div>
      )}
    </Sheet>
  )
}
