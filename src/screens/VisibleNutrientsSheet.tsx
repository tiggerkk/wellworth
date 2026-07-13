import { useState } from 'react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { Toggle } from '../components/Toggle'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useNutrientReference } from '../hooks/useNutrientReference'
import type { Tables, TablesUpdate } from '../types/database'

const VISIBLE_GROUPS: { label: string; categories: string[] }[] = [
  { label: 'General & Protein', categories: ['general', 'protein'] },
  { label: 'Vitamins', categories: ['vitamins'] },
  { label: 'Minerals', categories: ['minerals'] },
  { label: 'Carbohydrates', categories: ['carbohydrates'] },
  { label: 'Lipids', categories: ['lipids'] },
]

// Sparsely-populated micros (docs/05-seed-data.md note).
function isLimitedData(n: Tables<'nutrient'>): boolean {
  return (
    !n.default_visible && (n.parent_key != null || n.key === 'b7' || n.key === 'chromium')
  )
}

export function VisibleNutrientsSheet() {
  const { profile, loading, save } = useProfileEditor()
  const { nutrients } = useNutrientReference()

  return (
    <Sheet variant="full" label="Visible nutrients">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">Visible Nutrients</h1>
      </header>
      {loading && <p className="p-4 text-body text-text-secondary">Loading…</p>}
      {profile && nutrients && (
        <Picker profile={profile} nutrients={nutrients} save={save} />
      )}
    </Sheet>
  )
}

function Picker({
  profile,
  nutrients,
  save,
}: {
  profile: Tables<'profile'>
  nutrients: Tables<'nutrient'>[]
  save: (patch: TablesUpdate<'profile'>) => Promise<void>
}) {
  const [visible, setVisible] = useState<string[]>(profile.visible_nutrients)
  const [protein, setProtein] = useState(
    profile.protein_target_g == null ? '' : String(profile.protein_target_g),
  )

  function toggle(key: string, on: boolean) {
    const next = on ? [...visible, key] : visible.filter((k) => k !== key)
    setVisible(next)
    void save({ visible_nutrients: next })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-4">
        {VISIBLE_GROUPS.map((group) => {
          const rows = nutrients.filter((n) => group.categories.includes(n.category))
          if (rows.length === 0) return null
          return (
            <div key={group.label}>
              <h2 className="mb-1 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
                {group.label}
              </h2>
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                {rows.map((n) => (
                  <div
                    key={n.key}
                    className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                  >
                    {n.key === 'protein' ? (
                      // Protein keeps its target input inline beside the label (not stacked below).
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <p className="shrink-0 text-body text-text-primary">
                          {n.display_name}
                        </p>
                        <input
                          type="number"
                          step="any"
                          placeholder="Target g — DRI if blank"
                          value={protein}
                          onChange={(e) => setProtein(e.target.value)}
                          onBlur={() => {
                            const v = Number(protein)
                            void save({
                              protein_target_g:
                                protein.trim() === '' || !Number.isFinite(v) ? null : v,
                            })
                          }}
                          className="field-control min-w-0 flex-1"
                        />
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-body text-text-primary">
                          {n.display_name}
                        </p>
                        {isLimitedData(n) && (
                          <p className="text-caption text-text-tertiary">limited data</p>
                        )}
                      </div>
                    )}
                    <Toggle
                      checked={visible.includes(n.key)}
                      onChange={(on) => toggle(n.key, on)}
                      label={n.display_name}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
