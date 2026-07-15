import { useState } from 'react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { Toggle } from '../components/Toggle'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { MEDICAL_CATEGORY_LABELS } from '../constants/medical'
import { defaultTrackedTestKeys, medicalTestsByCategory } from '../lib/medical'
import type { Tables, TablesUpdate } from '../types/database'
import { EntryLoader } from '../components/EntryLoader'

/**
 * Medical → Tracked Tests: which tests trend on the Dashboard (the sparkline grid). Grouped by
 * category, a `Toggle` per test, persisted to `profile.medical_tracked_tests`. NULL falls back
 * to the seeded `default_tracked` starter set (also what `ensureOwnerProfile` seeds on first run).
 */
export function MedicalTrackedTestsSheet() {
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Tracked tests">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">Tracked Tests</h1>
      </header>

      <EntryLoader
        loading={loading}
        data={profile}
        errorText="Couldn’t load tracked tests."
      >
        {(prof) => <Picker profile={prof} save={save} />}
      </EntryLoader>
    </Sheet>
  )
}

function Picker({
  profile,
  save,
}: {
  profile: Tables<'profile'>
  save: (patch: TablesUpdate<'profile'>) => Promise<void>
}) {
  const [tracked, setTracked] = useState<string[]>(
    profile.medical_tracked_tests ?? defaultTrackedTestKeys(),
  )

  function toggle(key: string, on: boolean) {
    const next = on ? [...tracked, key] : tracked.filter((k) => k !== key)
    setTracked(next)
    void save({ medical_tracked_tests: next })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-4">
        {medicalTestsByCategory().map((group) => (
          <div key={group.category}>
            <h2 className="mb-1 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
              {MEDICAL_CATEGORY_LABELS[group.category]}
            </h2>
            <div className="overflow-hidden rounded-card border border-border bg-surface">
              {group.tests.map((test) => (
                <div
                  key={test.key}
                  className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                >
                  <p className="min-w-0 truncate text-body text-text-primary">
                    {test.display_name}
                  </p>
                  <Toggle
                    checked={tracked.includes(test.key)}
                    onChange={(on) => toggle(test.key, on)}
                    label={test.display_name}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
