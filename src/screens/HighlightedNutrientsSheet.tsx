import { useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { NUTRIENT_SECTIONS } from '../constants/nutrient-sections'
import type { Tables } from '../types/database'

const MAX = 8

export function HighlightedNutrientsSheet() {
  const { profile, loading, save } = useProfileEditor()
  const { nutrients } = useNutrientReference()

  return (
    <Sheet variant="full" label="Highlighted nutrients">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">
          Highlighted Nutrients
        </h1>
      </header>
      {loading && <p className="p-4 text-body text-text-secondary">Loading…</p>}
      {profile && nutrients && (
        <Picker
          initial={profile.highlighted_nutrients}
          nutrients={nutrients}
          onChange={(next) => void save({ highlighted_nutrients: next })}
        />
      )}
    </Sheet>
  )
}

function Picker({
  initial,
  nutrients,
  onChange,
}: {
  initial: string[]
  nutrients: Tables<'nutrient'>[]
  onChange: (next: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(initial)

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : selected.length < MAX
        ? [...selected, key]
        : selected
    if (next !== selected) {
      setSelected(next)
      onChange(next)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-3 text-caption text-text-secondary">
        Choose up to {MAX} for the Diary grid ({selected.length}/{MAX}).
      </p>
      <div className="flex flex-col gap-2">
        {NUTRIENT_SECTIONS.map((section) => {
          const rows = nutrients.filter((n) => n.category === section.category)
          if (rows.length === 0) return null
          return (
            <div key={section.category}>
              <h2 className="mb-1 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
                {section.label}
              </h2>
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                {rows.map((n) => {
                  const on = selected.includes(n.key)
                  const disabled = !on && selected.length >= MAX
                  return (
                    <button
                      key={n.key}
                      onClick={() => toggle(n.key)}
                      disabled={disabled}
                      className={`flex w-full items-center justify-between border-b border-border px-4 py-2.5 text-left last:border-b-0 ${
                        disabled ? 'opacity-40' : ''
                      }`}
                    >
                      <span className="text-body text-text-primary">
                        {n.display_name}
                      </span>
                      {on && <IconCheck size={18} className="text-accent" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
