import { EYE_REFRACTION_COLUMNS, EYE_REFRACTION_ROWS, labTestByKey } from '../lib/medical'
import type { ResultDraft } from '../lib/medical-draft'

interface EyeRefractionFieldsProps {
  /** The report's current result drafts (the six refraction rows are read by `test_key`). */
  results: ResultDraft[]
  /** Upsert/clear a refraction value by its test key (empty string removes the row). */
  onSet: (testKey: string, value: string) => void
}

/**
 * The structured eye-refraction grid (M7), shown on the Add/Edit form when the report type is **eye**:
 * a row per eye — displayed RE (right) / LE (left), keyed `*_od` / `*_os` — × Sphere / Cylinder /
 * Addition. Each cell edits the `value_num` of the
 * matching `eye`-category `medical_result` row (created on first input, removed when cleared), so the
 * values store + trend exactly like any other measurement — they just get a dedicated grid instead of
 * the generic test picker. The unit (dioptres) comes from the seed.
 */
export function EyeRefractionFields({ results, onSet }: EyeRefractionFieldsProps) {
  const valueOf = (key: string) =>
    results.find((r) => r.test_key === key)?.value_num ?? ''

  return (
    <div>
      <p className="mb-2 text-caption uppercase tracking-[0.08em] text-text-secondary">
        Eye Refraction
      </p>
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-px bg-border">
          {/* header row — the empty corner cell stretches so it fills the row (otherwise the
              `gap-px bg-border` grid lines show through above/below it as grey stripes) */}
          <div className="self-stretch bg-surface px-2 py-2" />
          {EYE_REFRACTION_COLUMNS.map((col) => (
            <div
              key={col}
              className="bg-surface px-2 py-2 text-center text-section uppercase tracking-wide text-text-secondary"
            >
              {col}
            </div>
          ))}
          {/* one row per eye */}
          {EYE_REFRACTION_ROWS.map((row) => (
            <Row
              key={row.eye}
              eye={row.eye}
              keys={row.keys}
              valueOf={valueOf}
              onSet={onSet}
            />
          ))}
        </div>
      </div>
      <p className="mt-1 px-1 text-section text-text-tertiary">
        RE = right eye, LE = left eye. Dioptres (D); leave a cell blank if not measured.
      </p>
    </div>
  )
}

function Row({
  eye,
  keys,
  valueOf,
  onSet,
}: {
  eye: string
  keys: string[]
  valueOf: (key: string) => string
  onSet: (testKey: string, value: string) => void
}) {
  return (
    <>
      <div className="flex items-center self-stretch bg-surface px-2 py-2 text-label font-medium text-text-primary">
        {eye}
      </div>
      {keys.map((key) => (
        <input
          key={key}
          type="number"
          inputMode="decimal"
          step="any"
          aria-label={labTestByKey.get(key)?.display_name ?? key}
          value={valueOf(key)}
          onChange={(e) => onSet(key, e.target.value)}
          className="w-full min-w-0 bg-surface px-2 py-2 text-center text-body text-text-primary focus:bg-input focus:outline-none"
        />
      ))}
    </>
  )
}
