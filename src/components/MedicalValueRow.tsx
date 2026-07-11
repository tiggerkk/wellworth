import type { ReactNode } from 'react'
import { MEDICAL_FLAG_CLASS, type MedicalFlag } from '../lib/medical'

/**
 * Presentational result row shared by the Medical Dashboard (latest-by-category list) and the View
 * Report detail (`ResultRow`).
 *
 * Short values (a number + unit) sit to the right of the name on one line — the classic lab-value
 * layout. Long, prose-style values (e.g. an ultrasound impression) don't fit in a narrow right column
 * without either truncating or overlapping the name (a `shrink-0` right column with unbounded text
 * fights the name's `flex-1` column down toward zero width, so the name's text overflows its own box
 * instead of wrapping). Past `LONG_VALUE_THRESHOLD` characters, the value is rendered as its own
 * full-width block below the name instead, so the entire text always stays visible and legible.
 *
 * The reference range (and `leftExtra`) used to live inside the name's flex sub-column, capping it at
 * that column's width (~55% of the row). They're now rendered as their own full-width line below the
 * name/value row so they can use the full row width, right up to the edge, before wrapping.
 *
 * Callers supply the row chrome (padding / border / review tint) via `className`, plus optional extra
 * lines: `leftExtra` (e.g. a "normalized from…" note + the Review marker) under the ref, and
 * `rightExtra` (e.g. the flag label) under the value.
 */

/** Values longer than this render as a full-width block below the name instead of a right column. */
const LONG_VALUE_THRESHOLD = 20

export function MedicalValueRow({
  name,
  refRange,
  value,
  flag,
  leftExtra,
  rightExtra,
  className = '',
}: {
  name: string
  refRange?: string | null
  /** Pre-formatted value text (e.g. `"5.5 mmol/L"`). */
  value: ReactNode
  flag?: MedicalFlag | null
  leftExtra?: ReactNode
  rightExtra?: ReactNode
  className?: string
}) {
  const isLongValue = typeof value === 'string' && value.length > LONG_VALUE_THRESHOLD
  const valueClass = `break-words text-body ${flag ? MEDICAL_FLAG_CLASS[flag] : 'text-text-primary'}`

  return (
    <div className={className}>
      {isLongValue ? (
        <div className="flex flex-col gap-0.5">
          <p className="break-words text-body text-text-primary">{name}</p>
          <p className={valueClass}>{value}</p>
          {rightExtra}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 break-words text-body text-text-primary">{name}</p>
          <div className="shrink-0 text-right">
            <p className={valueClass}>{value}</p>
            {rightExtra}
          </div>
        </div>
      )}
      {refRange && (
        <p className="mt-0.5 text-caption text-text-tertiary">Ref: {refRange}</p>
      )}
      {leftExtra}
    </div>
  )
}
