import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { IconHeart, IconHeartFilled, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { NutrientBar } from '../components/NutrientBar'
import { PrimaryButton } from '../components/PrimaryButton'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { createEntry } from '../data/diary-entry'
import { createFood, getFood, getFoodByExternal, setFavorite } from '../data/food'
import { listServings } from '../data/serving'
import { getUsdaFood } from '../lib/food-api'
import { lookupBarcode } from '../lib/off-api'
import {
  asNutrientMap,
  deriveNetCarbs,
  isOverUpperLimit,
  scaleNutrients,
} from '../lib/nutrients'
import { computeTargets } from '../lib/targets'
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
  const { session } = useAuth()
  const userId = session?.user.id
  const { source = 'usda', id = '' } = useParams()
  const [params] = useSearchParams()
  const group = params.get('group') ?? 'snacks'
  const day = params.get('day') ?? todayLocal()

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

  const [amount, setAmount] = useState(1)
  const [servingIndex, setServingIndex] = useState(0)
  const [favorite, setFavorite_] = useState(false)
  const [saving, setSaving] = useState(false)

  const serving = food?.servings[servingIndex] ?? food?.servings[0]
  const scaled = useMemo(() => {
    if (!food || !serving) return {}
    const basis = food.nutrientBasis === 'per_serving' ? serving.grams : 100
    return deriveNetCarbs(
      scaleNutrients(food.nutrients, {
        amount,
        servingGrams: serving.grams,
        basisGrams: basis,
      }),
    )
  }, [food, serving, amount])

  const targets = profile ? computeTargets(profile) : null
  const favShown = favorite || food?.isFavorite === true

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

  async function addToDiary() {
    if (!food || !userId || !serving) return
    setSaving(true)
    try {
      const foodId = await ensureCachedId(food)
      await createEntry({
        user_id: userId,
        day,
        group_name: group,
        kind: 'food',
        food_id: foodId,
        amount,
        energy_kcal: scaled.energy ?? 0,
        label: food.name,
        nutrients: scaled,
      })
      bumpDiary()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  async function toggleFavorite() {
    if (!food) return
    const next = !favShown
    setFavorite_(next)
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
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
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
        <div className="border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <PrimaryButton
            onClick={() => void addToDiary()}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Adding…' : 'ADD TO DIARY'}
          </PrimaryButton>
        </div>
      )}
    </Sheet>
  )
}
