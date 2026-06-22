import { useState } from 'react'
import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { Toggle } from '../components/Toggle'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { MEDICAL_REPORT_FIELDS } from '../lib/medical'
import type { Tables, TablesUpdate } from '../types/database'

/**
 * Medical → Visible Fields: which optional Add/Edit-Report fields are shown. NULL = all visible
 * (default-on); toggling writes the explicit array. Mirrors `ShowsFieldsSheet`. The core fields
 * (date, type, results) are always shown and aren't listed here.
 */
export function MedicalFieldsSheet() {
  const navigate = useNavigate()
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Visible fields">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Visible Fields</h1>
      </header>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {profile && <Picker profile={profile} save={save} />}
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
  const allKeys = MEDICAL_REPORT_FIELDS.map((f) => f.key)
  const [visible, setVisible] = useState<string[]>(
    profile.medical_visible_fields ?? allKeys,
  )

  function toggle(key: string, on: boolean) {
    const next = on ? [...visible, key] : visible.filter((k) => k !== key)
    setVisible(next)
    void save({ medical_visible_fields: next })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {MEDICAL_REPORT_FIELDS.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span className="text-[15px] text-text-primary">{f.label}</span>
            <Toggle
              checked={visible.includes(f.key)}
              onChange={(on) => toggle(f.key, on)}
              label={f.label}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
