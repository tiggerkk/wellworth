import type { ReactNode } from 'react'

interface FieldRowProps {
  label: string
  /** Small muted note shown inline right after the label (e.g. "(Dashboard)"). */
  hint?: string
  /** Right-aligned value/input/control. */
  children: ReactNode
}

/** label · value/input row, for forms and Settings. Hairline-divided inside a SectionCard. */
export function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="flex items-baseline gap-1.5 text-[15px] text-text-primary">
        {label}
        {hint && <span className="text-xs text-text-tertiary">{hint}</span>}
      </span>
      <span className="text-[15px] text-text-muted">{children}</span>
    </div>
  )
}
