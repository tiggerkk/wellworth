import type { ReactNode } from 'react'
import { MEDICAL_FLAG_CLASS, type MedicalFlag } from '../lib/medical'

/**
 * Presentational result row shared by the Medical Dashboard (latest-by-category list) and the View
 * Report detail (`ResultRow`). Name + the (often long, wrapping) reference range share the flexible
 * left column; the value (+ unit, flag-coloured) stays in a `shrink-0` right column with `items-start`
 * — so a long ref wraps under the name instead of squeezing the name or pushing the value off the
 * right edge.
 *
 * Callers supply the row chrome (padding / border / review tint) via `className`, plus optional extra
 * lines: `leftExtra` (e.g. a "normalized from…" note + the Review marker) under the ref, and
 * `rightExtra` (e.g. the flag label) under the value.
 */
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
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-text-primary">{name}</p>
        {refRange && <p className="text-xs text-text-tertiary">Ref: {refRange}</p>}
        {leftExtra}
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-[15px] ${flag ? MEDICAL_FLAG_CLASS[flag] : 'text-text-primary'}`}
        >
          {value}
        </p>
        {rightExtra}
      </div>
    </div>
  )
}
