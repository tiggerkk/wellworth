import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconPlus } from '@tabler/icons-react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { RemoveRowButton } from '../components/RemoveRowButton'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { Collapsible } from '../components/Collapsible'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { createFood, getFood, softDeleteFood, updateFood } from '../data/food'
import { listServings, replaceServings } from '../data/serving'
import { asNutrientMap, type NutrientMap } from '../lib/wellness-nutrients'
import { NUTRIENT_SECTIONS } from '../constants/wellness'
import { bumpDiary } from '../lib/wellness-diary-refresh'
import { EntryLoader } from '../components/EntryLoader'

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

export function WellnessFoodNewSheet() {
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
      <EntryLoader
        loading={loading}
        error={error}
        data={initial}
        errorText="Couldn’t load this item."
      >
        {(d) => <FoodForm id={id} initial={d} />}
      </EntryLoader>
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

  async function remove() {
    if (!id) return
    setSaving(true)
    try {
      await softDeleteFood(id)
      bumpDiary()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="min-w-0 flex-1 truncate text-heading font-medium text-text-primary">
          {id ? 'Edit Food' : 'New Food'}
        </h1>
        <EntryHeaderActions
          editing={!!id}
          dirty={dirty}
          saving={saving}
          canSubmit={!!name.trim()}
          onReset={reset}
          onSubmit={() => void save()}
          onDelete={id ? () => void remove() : undefined}
        />
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

        <label className="text-caption text-text-secondary">
          Food Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 field-control w-full"
          />
        </label>

        {/* Serving sizes */}
        <div>
          <p className="mb-1 text-caption text-text-secondary">Serving Sizes</p>
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
                  className="field-control flex-1"
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
                  className="field-control w-20"
                />
                <RemoveRowButton
                  onClick={() => setServings((prev) => prev.filter((_, j) => j !== i))}
                  label="Remove serving"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setServings((prev) => [...prev, { name: '', grams: '' }])}
            className="mt-2 flex items-center gap-1 text-body text-positive"
          >
            <IconPlus size={16} /> Add serving size
          </button>
        </div>

        {/* Basis */}
        <div>
          <p className="mb-1 text-caption text-text-secondary">Nutrition Shown Per</p>
          <SegmentedTabs
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'per_100g', label: 'Per 100 g' },
              { value: 'per_serving', label: 'Per Serving' },
            ]}
          />
        </div>

        {/* Nutrition facts */}
        <div>
          <p className="mb-2 text-caption text-text-secondary">
            Nutrition Facts (Per {basisLabel})
          </p>
          <div className="flex flex-col gap-2">
            {NUTRIENT_SECTIONS.map((section) => {
              const rows = (refRows ?? []).filter((n) => n.category === section.category)
              if (rows.length === 0) return null
              return (
                <Collapsible
                  key={section.category}
                  title={section.label}
                  titleCase="caption"
                  bodyClassName="px-4 py-1"
                  defaultOpen={section.category === 'general'}
                >
                  {rows.map((n) => (
                    <div
                      key={n.key}
                      className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                    >
                      <span className="text-body text-text-primary">
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
                          className="field-control w-20 text-right"
                        />
                        <span className="w-7 text-caption text-text-secondary">
                          {n.unit}
                        </span>
                      </span>
                    </div>
                  ))}
                </Collapsible>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
