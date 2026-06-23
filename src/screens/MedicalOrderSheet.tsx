import { useState } from 'react'
import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { SelectMenu } from '../components/SelectMenu'
import { ReorderList } from '../components/ReorderList'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { MEDICAL_CATEGORY_LABELS, type MedicalCategory } from '../lib/medical'
import { buildOrderModel, flattenTestOrder, testDisplayName } from '../lib/medical-order'
import type { Tables, TablesUpdate } from '../types/database'

/**
 * Medical → Display Order (M5): drag-to-reorder the category **sections** and the **tests within a
 * section**. Saved as personal overrides on the profile (`medical_section_order` / a flat
 * `medical_test_order`), consumed by `orderResultsForDisplay` on the Dashboard + Report detail;
 * unset/partial overrides fall back to the seeded order. Mirrors the other Medical settings sheets.
 */
export function MedicalOrderSheet() {
  const navigate = useNavigate()
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Display order">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Display Order</h1>
      </header>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {profile && <Editor profile={profile} save={save} />}
    </Sheet>
  )
}

function Editor({
  profile,
  save,
}: {
  profile: Tables<'profile'>
  save: (patch: TablesUpdate<'profile'>) => Promise<void>
}) {
  const initial = buildOrderModel(
    profile.medical_section_order,
    profile.medical_test_order,
  )
  const [sectionOrder, setSectionOrder] = useState<MedicalCategory[]>(
    initial.sectionOrder,
  )
  const [testsByCategory, setTestsByCategory] = useState<Record<string, string[]>>(
    initial.testsByCategory,
  )
  const [selectedCat, setSelectedCat] = useState<MedicalCategory>(
    initial.sectionOrder[0]!,
  )

  function reorderSections(next: string[]) {
    const order = next as MedicalCategory[]
    setSectionOrder(order)
    // Re-flatten the test order so the stored flat array stays grouped by the new section order.
    void save({
      medical_section_order: order,
      medical_test_order: flattenTestOrder(order, testsByCategory),
    })
  }

  function reorderTests(next: string[]) {
    const nextMap = { ...testsByCategory, [selectedCat]: next }
    setTestsByCategory(nextMap)
    void save({ medical_test_order: flattenTestOrder(sectionOrder, nextMap) })
  }

  const catOptions = sectionOrder.map((c) => ({
    value: c,
    label: MEDICAL_CATEGORY_LABELS[c],
  }))

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="mb-1 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            Sections
          </h2>
          <ReorderList
            ids={sectionOrder}
            onReorder={reorderSections}
            renderLabel={(c) => MEDICAL_CATEGORY_LABELS[c as MedicalCategory]}
            handleLabel={(c) =>
              `Reorder ${MEDICAL_CATEGORY_LABELS[c as MedicalCategory]} section`
            }
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2 px-1">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
              Tests in section
            </h2>
            <div className="w-44">
              <SelectMenu
                value={selectedCat}
                onChange={(c) => setSelectedCat(c)}
                options={catOptions}
                ariaLabel="Choose a section to reorder its tests"
              />
            </div>
          </div>
          <ReorderList
            ids={testsByCategory[selectedCat] ?? []}
            onReorder={reorderTests}
            renderLabel={(k) => testDisplayName(k)}
            handleLabel={(k) => `Reorder ${testDisplayName(k)}`}
          />
        </div>
      </div>
    </div>
  )
}
