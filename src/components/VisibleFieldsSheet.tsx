import { useState } from 'react'
import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from './Sheet'
import { Toggle } from './Toggle'
import { useProfileEditor } from '../hooks/useProfileEditor'
import type { Tables, TablesUpdate } from '../types/database'

/** The `profile` `text[]` columns that store a module's per-field visibility (NULL = all visible). */
export type VisibleFieldsColumn =
  | 'show_visible_fields'
  | 'book_visible_fields'
  | 'quote_visible_fields'
  | 'medical_visible_fields'
  | 'travel_visible_fields'

/** A boolean `profile` column rendered as an extra toggle interleaved into the list (Shows Poster URL). */
type BooleanColumn = 'show_poster_url_visible'

interface FieldDef {
  key: string
  label: string
}

interface ExtraToggle {
  label: string
  /** Its own boolean profile column (separate default from the `text[]` list). */
  column: BooleanColumn
  /** Render this extra right after the field with this key (or at the top when `null`). */
  afterKey: string | null
}

interface VisibleFieldsSheetProps {
  intro: string
  fields: FieldDef[]
  column: VisibleFieldsColumn
  extras?: ExtraToggle[]
}

/**
 * Shared "Visible Fields" sheet for every module's Settings — auto-saves each toggle. The module's
 * `text[]` column is NULL until the owner customizes (all fields visible); the first toggle writes the
 * explicit array. `fields` order should mirror the New/Edit form; `extras` are boolean-column toggles
 * (e.g. Shows' Poster URL) interleaved into form-order position.
 */
export function VisibleFieldsSheet({
  intro,
  fields,
  column,
  extras = [],
}: VisibleFieldsSheetProps) {
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
      {profile && (
        <Picker
          profile={profile}
          save={save}
          intro={intro}
          fields={fields}
          column={column}
          extras={extras}
        />
      )}
    </Sheet>
  )
}

function Picker({
  profile,
  save,
  intro,
  fields,
  column,
  extras,
}: {
  profile: Tables<'profile'>
  save: (patch: TablesUpdate<'profile'>) => Promise<void>
  intro: string
  fields: FieldDef[]
  column: VisibleFieldsColumn
  extras: ExtraToggle[]
}) {
  const allKeys = fields.map((f) => f.key)
  const [visible, setVisible] = useState<string[]>(profile[column] ?? allKeys)
  const [extraOn, setExtraOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(extras.map((e) => [e.column, profile[e.column]])),
  )

  function toggle(key: string, on: boolean) {
    const next = on ? [...visible, key] : visible.filter((k) => k !== key)
    setVisible(next)
    void save({ [column]: next } as TablesUpdate<'profile'>)
  }

  function toggleExtra(e: ExtraToggle, on: boolean) {
    setExtraOn((prev) => ({ ...prev, [e.column]: on }))
    void save({ [e.column]: on } as TablesUpdate<'profile'>)
  }

  const topExtras = extras.filter((e) => e.afterKey == null)

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-2 px-1 text-xs text-text-secondary">{intro}</p>
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {topExtras.map((e) => (
          <Row
            key={e.column}
            label={e.label}
            checked={extraOn[e.column] ?? false}
            onChange={(on) => toggleExtra(e, on)}
          />
        ))}
        {fields.map((f) => (
          <FieldRows
            key={f.key}
            field={f}
            checked={visible.includes(f.key)}
            onToggle={(on) => toggle(f.key, on)}
            extras={extras.filter((e) => e.afterKey === f.key)}
            extraOn={extraOn}
            onToggleExtra={toggleExtra}
          />
        ))}
      </div>
    </div>
  )
}

function FieldRows({
  field,
  checked,
  onToggle,
  extras,
  extraOn,
  onToggleExtra,
}: {
  field: FieldDef
  checked: boolean
  onToggle: (on: boolean) => void
  extras: ExtraToggle[]
  extraOn: Record<string, boolean>
  onToggleExtra: (e: ExtraToggle, on: boolean) => void
}) {
  return (
    <>
      <Row label={field.label} checked={checked} onChange={onToggle} />
      {extras.map((e) => (
        <Row
          key={e.column}
          label={e.label}
          checked={extraOn[e.column] ?? false}
          onChange={(on) => onToggleExtra(e, on)}
        />
      ))}
    </>
  )
}

function Row({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <span className="text-[15px] text-text-primary">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
