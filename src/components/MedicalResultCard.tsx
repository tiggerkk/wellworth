import { IconTrash } from '@tabler/icons-react'
import {
  labTestByKey,
  MEDICAL_CATEGORIES,
  MEDICAL_CATEGORY_LABELS,
  MEDICAL_FLAG_LABELS,
  type MedicalFlag,
} from '../lib/medical'
import type { ResultDraft } from '../lib/medical-draft'
import { SelectMenu } from './SelectMenu'
import { StatusChip } from './StatusChip'
import { Toggle } from './Toggle'

const inputClass =
  'w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none'

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
 * `ref_low`/`ref_high` (set by the importer's normalization) are carried through unchanged.
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

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        {isCustom ? (
          <input
            value={row.test_name}
            onChange={(e) => onChange({ test_name: e.target.value })}
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

      {isCustom ? (
        <SelectMenu
          value={row.category}
          onChange={(category) => onChange({ category })}
          ariaLabel="Category"
          options={MEDICAL_CATEGORIES.map((c) => ({
            value: c,
            label: MEDICAL_CATEGORY_LABELS[c],
          }))}
        />
      ) : (
        <StatusChip
          label={MEDICAL_CATEGORY_LABELS[row.category]}
          className="self-start bg-input text-text-secondary"
        />
      )}

      <div className="flex gap-2">
        {showNumber && (
          <label className="flex-1 text-[11px] text-text-secondary">
            Value
            <input
              inputMode="decimal"
              value={row.value_num}
              onChange={(e) => onChange({ value_num: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        )}
        <label className="w-28 text-[11px] text-text-secondary">
          Unit
          <input
            value={row.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      {showText && (
        <label className="text-[11px] text-text-secondary">
          Result text
          <input
            value={row.value_text}
            onChange={(e) => onChange({ value_text: e.target.value })}
            placeholder="e.g. Negative, Normal"
            className={`mt-1 ${inputClass}`}
          />
        </label>
      )}

      <label className="text-[11px] text-text-secondary">
        Reference range
        <input
          value={row.ref_text}
          onChange={(e) => onChange({ ref_text: e.target.value })}
          placeholder="exactly as printed, e.g. 3.5-7.2"
          className={`mt-1 ${inputClass}`}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <SelectMenu
          value={row.flag}
          onChange={(flag) => onChange({ flag })}
          ariaLabel="Flag"
          className="w-32"
          options={FLAG_OPTIONS}
        />
        <label className="flex items-center gap-2 text-[11px] text-text-secondary">
          Uncertain
          <Toggle
            checked={row.uncertain}
            onChange={(uncertain) => onChange({ uncertain })}
            label="Uncertain"
          />
        </label>
      </div>

      {row.normalized && row.value_num_original != null && (
        <p className="text-[11px] text-text-tertiary">
          normalized from {row.value_num_original}
          {row.unit_original ? ` ${row.unit_original}` : ''}
        </p>
      )}
    </div>
  )
}
