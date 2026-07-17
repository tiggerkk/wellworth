import { useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { SearchBar } from './SearchBar'
import { MEDICAL_CATEGORY_LABELS, type MedicalLabTestSeed } from '../constants/medical'
import { medicalTestsByCategory } from '../lib/medical'
import { foldZh } from '../lib/zh-fold'

interface MedicalTestPickerOverlayProps {
  onSelect: (test: MedicalLabTestSeed) => void
  onAddCustom: () => void
  onClose: () => void
}

/**
 * Test picker for the Add/Edit Report form — a **local** fixed overlay (not the routing `Sheet`,
 * which would remount the Entry form and lose the in-progress draft). Searches the static
 * `MEDICAL_LAB_TESTS` reference grouped by category; selecting one prefills a result row, or
 * "Add custom test" creates an ad-hoc row (test_key null).
 */
export function MedicalTestPickerOverlay({
  onSelect,
  onAddCustom,
  onClose,
}: MedicalTestPickerOverlayProps) {
  const [query, setQuery] = useState('')

  const term = foldZh(query.trim())
  const groups = medicalTestsByCategory()
    .map((g) => ({
      ...g,
      tests: term
        ? g.tests.filter(
            (t) => foldZh(t.display_name).includes(term) || foldZh(t.key).includes(term),
          )
        : g.tests,
    }))
    .filter((g) => g.tests.length > 0)

  return (
    <OverlayTop onClose={onClose} label="Add a test">
      <ScreenHeaderTitle onClose={onClose}>
        <div className="flex-1">
          <SearchBar value={query} onChange={setQuery} placeholder="Search tests" />
        </div>
      </ScreenHeaderTitle>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <button
          onClick={onAddCustom}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-input bg-input py-2.5 text-body text-positive active:bg-input/60"
        >
          <IconPlus size={16} /> Add custom test
        </button>

        {groups.map((g) => (
          <div key={g.category} className="mb-4">
            <h2 className="mb-1 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
              {MEDICAL_CATEGORY_LABELS[g.category]}
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
              {g.tests.map((t) => (
                <button
                  key={t.key}
                  onClick={() => onSelect(t)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left active:bg-input/40"
                >
                  <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                    {t.display_name}
                  </span>
                  {t.default_unit && (
                    <span className="shrink-0 text-caption text-text-tertiary">
                      {t.default_unit}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <p className="px-4 py-6 text-center text-body text-text-tertiary">
            No tests match "{query}". Use "Add custom test" for one not in the list.
          </p>
        )}
      </div>
    </OverlayTop>
  )
}
