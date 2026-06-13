import type { ReactNode } from 'react'

interface FieldRowProps {
  label: string
  /** Right-aligned value/input/control. */
  children: ReactNode
}

/** label · value/input row, for forms and Settings. Hairline-divided inside a SectionCard. */
export function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="text-[15px] text-text-primary">{label}</span>
      <span className="text-[15px] text-text-muted">{children}</span>
    </div>
  )
}
