import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { createFood, getFood, updateFood } from '../data/food'
import { listServings, replaceServings } from '../data/serving'
import { asNutrientMap, type NutrientMap } from '../lib/nutrients'
import { NUTRIENT_SECTIONS } from '../constants/nutrient-sections'
import { bumpDiary } from '../lib/diary-refresh'

interface ServingDraft {
  name: string
  grams: string
}
interface FoodInitial {
  type: string
  name: string
  basis: string
  servings: ServingDraft[]
  nutrients: Record<string, string>
}

const BLANK: FoodInitial = {
  type: 'food',
  name: '',
  basis: 'per_100g',
  servings: [{ name: '', grams: '' }],
  nutrients: {},
}

export function NewFoodSheet() {
  const { id } = useParams()
  const isEdit = !!id

  const loadFn = useCallback(async (): Promise<FoodInitial | null> => {
    if (!id) return BLANK
    const food = await getFood(id)
    if (!food) return null
    const servings = await listServings(id)
    const nutrients: Record<string, string> = {}
    for (const [k, v] of Object.entries(asNutrientMap(food.nutrients))) {
      if (v != null) nutrients[k] = String(v)
    }
    return {
      type: food.type,
      name: food.name,
      basis: food.nutrient_basis,
      servings:
        servings.length > 0
          ? servings.map((s) => ({ name: s.name, grams: String(s.grams) }))
          : [{ name: '', grams: '' }],
      nutrients,
    }
  }, [id])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <Sheet variant="full" label={isEdit ? 'Edit food' : 'New food'}>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {(error || (!loading && !initial)) && (
        <p className="p-4 text-sm text-danger">Couldn’t load this item.</p>
      )}
      {initial && <FoodForm id={id} initial={initial} />}
    </Sheet>
  )
}

function FoodForm({ id, initial }: { id: string | undefined; initial: FoodInitial }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { nutrients: refRows } = useNutrientReference()

  const [type, setType] = useState(initial.type)
  const [name, setName] = useState(initial.name)
  const [basis, setBasis] = useState(initial.basis)
  const [servings, setServings] = useState<ServingDraft[]>(initial.servings)
  const [values, setValues] = useState<Record<string, string>>(initial.nutrients)
  const [saving, setSaving] = useState(false)

  const basisLabel = basis === 'per_serving' ? 'serving' : '100 g'
  const actionLabel = id ? 'SAVE' : 'CREATE'
  const busyLabel = id ? 'Saving…' : 'Adding…'

  // Dirty vs the loaded/blank initial — drives RESET + SAVE enablement.
  const dirty =
    JSON.stringify({ type, name, basis, servings, values }) !==
    JSON.stringify({
      type: initial.type,
      name: initial.name,
      basis: initial.basis,
      servings: initial.servings,
      values: initial.nutrients,
    })

  function reset() {
    setType(initial.type)
    setName(initial.name)
    setBasis(initial.basis)
    setServings(initial.servings.map((s) => ({ ...s })))
    setValues({ ...initial.nutrients })
  }

  async function save() {
    if (!userId || !name.trim()) return
    setSaving(true)
    try {
      const nutrients: NutrientMap = {}
      for (const [k, v] of Object.entries(values)) {
        const n = Number(v)
        if (v.trim() !== '' && Number.isFinite(n)) nutrients[k] = n
      }
      const rows = servings
        .filter((s) => s.name.trim() && Number(s.grams) > 0)
        .map((s) => ({ name: s.name.trim(), grams: Number(s.grams) }))

      if (id) {
        await updateFood(id, {
          name: name.trim(),
          type,
          nutrient_basis: basis,
          nutrients,
        })
        await replaceServings(id, rows)
      } else {
        const created = await createFood({
          user_id: userId,
          source: 'custom',
          name: name.trim(),
          type,
          nutrient_basis: basis,
          nutrients,
          is_favorite: false,
        })
        await replaceServings(created.id, rows)
      }
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
          {id ? 'Edit Food' : 'New Food'}
        </h1>
        <SecondaryButton size="sm" onClick={reset} disabled={!dirty || saving}>
          RESET
        </SecondaryButton>
        <PrimaryButton
          size="sm"
          onClick={() => void save()}
          disabled={saving || !name.trim() || (!!id && !dirty)}
        >
          {saving ? busyLabel : actionLabel}
        </PrimaryButton>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <SegmentedTabs
          value={type}
          onChange={setType}
          options={[
            { value: 'food', label: 'Food' },
            { value: 'supplement', label: 'Supplement' },
          ]}
        />

        <label className="text-xs text-text-secondary">
          Food Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
          />
        </label>

        {/* Serving sizes */}
        <div>
          <p className="mb-1 text-xs text-text-secondary">Serving Sizes</p>
          <div className="flex flex-col gap-2">
            {servings.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={s.name}
                  placeholder="e.g. 1 cup"
                  onChange={(e) =>
                    setServings((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  className="flex-1 rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={s.grams}
                  placeholder="g"
                  onChange={(e) =>
                    setServings((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)),
                    )
                  }
                  className="w-20 rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
                />
                <button
                  onClick={() => setServings((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Remove serving"
                  className="text-text-tertiary"
                >
                  <IconTrash size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setServings((prev) => [...prev, { name: '', grams: '' }])}
            className="mt-2 flex items-center gap-1 text-sm text-positive"
          >
            <IconPlus size={16} /> Add serving size
          </button>
        </div>

        {/* Basis */}
        <div>
          <p className="mb-1 text-xs text-text-secondary">Nutrition shown per</p>
          <SegmentedTabs
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'per_100g', label: 'Per 100 g' },
              { value: 'per_serving', label: 'Per serving' },
            ]}
          />
        </div>

        {/* Nutrition facts */}
        <div>
          <p className="mb-2 text-xs text-text-secondary">
            Nutrition Facts (per {basisLabel})
          </p>
          <div className="flex flex-col gap-2">
            {NUTRIENT_SECTIONS.map((section) => {
              const rows = (refRows ?? []).filter((n) => n.category === section.category)
              if (rows.length === 0) return null
              return (
                <CollapsibleSection
                  key={section.category}
                  title={section.label}
                  defaultOpen={section.category === 'general'}
                >
                  {rows.map((n) => (
                    <div
                      key={n.key}
                      className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                    >
                      <span className="text-[15px] text-text-primary">
                        {n.display_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={values[n.key] ?? ''}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [n.key]: e.target.value }))
                          }
                          className="w-20 rounded-input bg-input px-2 py-1.5 text-right text-[15px] text-text-primary focus:outline-none"
                        />
                        <span className="w-7 text-xs text-text-secondary">{n.unit}</span>
                      </span>
                    </div>
                  ))}
                </CollapsibleSection>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
