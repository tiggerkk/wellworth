import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { IconPlus } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RemoveRowButton } from '../components/RemoveRowButton'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { Collapsible } from '../components/Collapsible'
import { useAuth } from '../auth/AuthProvider'
import { useDirty } from '../hooks/useDirty'
import { useEntryDraft } from '../hooks/useEntryDraft'
import { useEntryClose } from '../hooks/useEntryClose'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { createFood, getFood, softDeleteFood, updateFood } from '../data/food'
import { listServings, replaceServings } from '../data/serving'
import { asNutrientMap, type NutrientMap } from '../lib/wellness-nutrients'
import { NUTRIENT_SECTIONS } from '../constants/wellness'
import { bumpDiary } from '../lib/wellness-diary-refresh'
import { routes } from '../constants/routes'
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

function blankDraft(): FoodInitial {
  return BLANK
}

interface FoodRow {
  food: NonNullable<Awaited<ReturnType<typeof getFood>>>
  servings: Awaited<ReturnType<typeof listServings>>
}

/** Fetches the food + its servings together. Module-level (stable identity) — `useEntryDraft`
 *  re-fetches whenever this reference changes, so it must NOT be recreated on every render (an
 *  inline arrow function here previously caused an infinite refetch loop). */
async function fetchFoodRow(id: string): Promise<FoodRow | null> {
  const food = await getFood(id)
  if (!food) return null
  const servings = await listServings(id)
  return { food, servings }
}

/** Maps the fetched food + servings to the Edit form's draft shape. Also module-level for the same
 *  stable-identity reason. */
function toDraft({ food, servings }: FoodRow): FoodInitial {
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
}

/**
 * Food — Entry / Edit. Outer loader + inner form keyed by id; `useEntryDraft` guarantees a
 * New-mode render never shows a previous edit's stale data (see its docstring).
 *
 * Close/Save navigation is fixed-destination (`useEntryClose`), not a history pop: Edit Food's
 * Cancel/Save always return to the Library listing; New Food's Cancel returns to wherever it was
 * opened from, and Save moves to the new food's fixed Edit route. `dirty` is lifted from `FoodForm`
 * (via `onDirtyChange`) since the close button lives in this outer, always-mounted header.
 */
export function WellnessFoodEntry() {
  const { id } = useParams()

  const { initial, loading, error } = useEntryDraft({
    id,
    fetchRow: fetchFoodRow,
    toDraft,
    blank: blankDraft,
  })

  const [dirty, setDirty] = useState(false)
  const { requestClose, afterSave, confirm } = useEntryClose({
    editing: !!id,
    dirty,
    listing: routes.wellness.library,
    editRoute: routes.wellness.editFood,
  })

  useEscapeKey(requestClose)

  return (
    <Sheet variant="full" label={id ? 'Edit Food' : 'New Food'} onClose={requestClose}>
      {/* This outer header is always mounted, so it displays "Loading" gracefully with the header
          structure perfectly intact. */}
      <ScreenHeaderTitle
        title={id ? 'Edit Food' : 'New Food'}
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
          <FoodForm
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
        message="You have unsaved changes to this food. Discard them?"
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </Sheet>
  )
}

function FoodForm({
  id,
  initial,
  onDirtyChange,
  afterSave,
}: {
  id: string | undefined
  initial: FoodInitial
  onDirtyChange: (dirty: boolean) => void
  afterSave: (newId: string, toastMessage?: string) => void
}) {
  const { session } = useAuth()
  const userId = session?.user.id
  const { nutrients: refRows } = useNutrientReference()

  const [draft, setDraft] = useState<FoodInitial>(initial)
  const [saving, setSaving] = useState(false)

  const update = (patch: Partial<FoodInitial>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = useDirty(draft, initial)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const basisLabel = draft.basis === 'per_serving' ? 'serving' : '100 g'

  async function save() {
    if (!userId || !draft.name.trim()) return
    setSaving(true)
    try {
      const nutrients: NutrientMap = {}
      for (const [k, v] of Object.entries(draft.nutrients)) {
        const n = Number(v)
        if (v.trim() !== '' && Number.isFinite(n)) nutrients[k] = n
      }
      const rows = draft.servings
        .filter((s) => s.name.trim() && Number(s.grams) > 0)
        .map((s) => ({ name: s.name.trim(), grams: Number(s.grams) }))

      const newId = id
        ? id
        : (
            await createFood({
              user_id: userId,
              source: 'custom',
              name: draft.name.trim(),
              type: draft.type,
              nutrient_basis: draft.basis,
              nutrients,
              is_favorite: false,
            })
          ).id
      if (id) {
        await updateFood(id, {
          name: draft.name.trim(),
          type: draft.type,
          nutrient_basis: draft.basis,
          nutrients,
        })
      }
      await replaceServings(newId, rows)
      bumpDiary()
      afterSave(newId, id ? 'Food saved' : 'Food added')
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
      afterSave(id, 'Food deleted')
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
          canSubmit={!!draft.name.trim()}
          onReset={() => setDraft(initial)}
          onSubmit={() => void save()}
          onDelete={id ? () => void remove() : undefined}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <SegmentedTabs
          value={draft.type}
          onChange={(type) => update({ type })}
          options={[
            { value: 'food', label: 'Food' },
            { value: 'supplement', label: 'Supplement' },
          ]}
        />

        <label className="text-caption text-text-secondary">
          Food Name
          <input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-1 field-control w-full"
          />
        </label>

        {/* Serving sizes */}
        <div>
          <p className="mb-1 text-caption text-text-secondary">Serving Sizes</p>
          <div className="flex flex-col gap-2">
            {draft.servings.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={s.name}
                  placeholder="e.g. 1 cup"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      servings: d.servings.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    }))
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
                    setDraft((d) => ({
                      ...d,
                      servings: d.servings.map((x, j) =>
                        j === i ? { ...x, grams: e.target.value } : x,
                      ),
                    }))
                  }
                  className="field-control w-20"
                />
                <RemoveRowButton
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      servings: d.servings.filter((_, j) => j !== i),
                    }))
                  }
                  label="Remove serving"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              update({ servings: [...draft.servings, { name: '', grams: '' }] })
            }
            className="mt-2 flex items-center gap-1 text-body text-positive"
          >
            <IconPlus size={16} /> Add serving size
          </button>
        </div>

        {/* Basis */}
        <div>
          <p className="mb-1 text-caption text-text-secondary">Nutrition Shown Per</p>
          <SegmentedTabs
            value={draft.basis}
            onChange={(basis) => update({ basis })}
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
                          value={draft.nutrients[n.key] ?? ''}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              nutrients: { ...d.nutrients, [n.key]: e.target.value },
                            }))
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
    </>
  )
}
