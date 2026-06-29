import { IconTrash } from '@tabler/icons-react'
import {
  labTestByKey,
  MEDICAL_CATEGORIES,
  MEDICAL_CATEGORY_COLOR,
  MEDICAL_CATEGORY_LABELS,
  MEDICAL_FLAG_LABELS,
  medicalReviewReason,
  type MedicalFlag,
} from '../lib/medical'
import type { ResultDraft } from '../lib/medical-draft'
import { SelectMenu } from './SelectMenu'

// Shared single-line field standard — see `.field-control` in index.css.
const inputClass = 'field-control w-full'

const FLAG_OPTIONS: { value: '' | MedicalFlag; label: string }[] = [
  { value: '', label: 'No flag' },
  { value: 'high', label: MEDICAL_FLAG_LABELS.high },
  { value: 'low', label: MEDICAL_FLAG_LABELS.low },
  { value: 'abnormal', label: MEDICAL_FLAG_LABELS.abnormal },
]

/**
 * Inline editor for one result row — shared by the manual Add/Edit form and the import review screen.
 * Numeric vs text value inputs follow the matched test's `value_kind` (a custom/ad-hoc row, or an
 * `either` test, shows both). The reference range is a single "as printed" text field; the numeric
 * `ref_low`/`ref_high` (set by the importer's normalization) are carried through unchanged. The
 * category isn't shown for a matched row — it comes from the section header the caller groups under;
 * a custom row keeps a category picker (it decides the row's group).
 *
 * The "uncertain" flag is **review state**, never a manual toggle: a flagged row shows a
 * `Review – <reason>` marker + a **Mark Reviewed** button, and **editing any field also clears it**
 * (the `edit` wrapper) — so reviewing the row, here or later in Edit Report, resolves it.
 */
export function MedicalResultCard({
  row,
  onChange,
  onRemove,
}: {
  row: ResultDraft
  onChange: (patch: Partial<ResultDraft>) => void
  onRemove: () => void
}) {
  const isCustom = row.test_key == null
  const kind = row.test_key
    ? (labTestByKey.get(row.test_key)?.value_kind ?? 'either')
    : 'either'
  const showNumber = kind !== 'qualitative'
  const showText = kind !== 'numeric'

  // Any field edit counts as reviewing the row — clear the review flag unless the patch itself sets
  // `uncertain` (the Mark Reviewed button passes `{ uncertain: false }` straight through).
  const edit = (patch: Partial<ResultDraft>) => {
    if (row.uncertain && !('uncertain' in patch)) onChange({ ...patch, uncertain: false })
    else onChange(patch)
  }

  const reviewReason = medicalReviewReason({
    uncertain: row.uncertain,
    testKey: row.test_key,
    hasNumericValue: row.value_num.trim() !== '',
  })

  return (
    <div
      // A 4px left stripe in the row's category colour (same hue as the section header it sits
      // under) ties each card to its group; the inline left border overrides the class border.
      style={{ borderLeft: `4px solid ${MEDICAL_CATEGORY_COLOR[row.category]}` }}
      className={`flex flex-col gap-2 rounded-card border p-3 ${
        reviewReason ? 'border-accent/40 bg-accent/10' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {isCustom ? (
          <input
            value={row.test_name}
            onChange={(e) => edit({ test_name: e.target.value })}
            placeholder="Test name"
            className={inputClass}
          />
        ) : (
          <span className="min-w-0 flex-1 text-[15px] text-text-primary">
            {row.test_name}
          </span>
        )}
        <button
          onClick={onRemove}
          aria-label="Remove result"
          className="shrink-0 p-1 text-text-tertiary"
        >
          <IconTrash size={18} />
        </button>
      </div>

      {isCustom && (
        <SelectMenu
          value={row.category}
          onChange={(category) => edit({ category })}
          ariaLabel="Category"
          options={MEDICAL_CATEGORIES.map((c) => ({
            value: c,
            label: MEDICAL_CATEGORY_LABELS[c],
          }))}
        />
      )}

      <div className="flex gap-2">
        {showNumber && (
          <div className="flex-1">
            <p className="mb-1 text-xs text-text-secondary">Value</p>
            <input
              inputMode="decimal"
              value={row.value_num}
              onChange={(e) => edit({ value_num: e.target.value })}
              className={inputClass}
            />
          </div>
        )}
        <div className="w-20">
          <p className="mb-1 text-xs text-text-secondary">Unit</p>
          <input
            value={row.unit}
            onChange={(e) => edit({ unit: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="w-28">
          <p className="mb-1 text-xs text-text-secondary">Flag</p>
          <SelectMenu
            value={row.flag}
            onChange={(flag) => edit({ flag })}
            ariaLabel="Flag"
            options={FLAG_OPTIONS}
          />
        </div>
      </div>

      {showText && (
        <label className="text-xs text-text-secondary">
          Result text
          <input
            value={row.value_text}
            onChange={(e) => edit({ value_text: e.target.value })}
            placeholder="e.g. Negative, Normal"
            className={`mt-1 ${inputClass}`}
          />
        </label>
      )}

      <label className="text-xs text-text-secondary">
        Reference Range
        <input
          value={row.ref_text}
          onChange={(e) => edit({ ref_text: e.target.value })}
          placeholder="Exactly as printed, e.g. 3.5-7.2"
          className={`mt-1 ${inputClass}`}
        />
      </label>

      {row.normalized && row.value_num_original != null && (
        <p className="text-[11px] text-text-tertiary">
          normalized from {row.value_num_original}
          {row.unit_original ? ` ${row.unit_original}` : ''}
        </p>
      )}

      {reviewReason && (
        <div className="flex items-center justify-between gap-3 border-t border-accent/20 pt-2">
          <span className="text-[13px] font-medium text-accent">
            Review – {reviewReason}
          </span>
          <button
            onClick={() => onChange({ uncertain: false })}
            className="shrink-0 rounded-pill bg-input px-2.5 py-1 text-xs font-medium text-accent"
          >
            Mark Reviewed
          </button>
        </div>
      )}
    </div>
  )
}
