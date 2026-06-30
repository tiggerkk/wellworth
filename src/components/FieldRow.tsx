import type { ReactNode } from 'react'

interface FieldRowProps {
  label: string
  /** Small muted note shown inline right after the label (e.g. "(Dashboard)"). */
  hint?: string
  /** Right-aligned value/input/control. */
  children: ReactNode
}

/**
 * label · value/input row, for forms and Settings. Hairline-divided inside a SectionCard.
 * `flex-wrap` + `min-w-0` let the value drop to its own line (rather than squeezing or overflowing)
 * when label + value can't share a row — e.g. at a larger Dynamic Type preset (F23) or with a long
 * value. At the default size everything still fits on one line, so nothing changes there.
 */
export function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border px-4 py-3 last:border-b-0">
      <span className="flex min-w-0 items-baseline gap-1.5 text-body text-text-primary">
        {label}
        {hint && <span className="text-caption text-text-tertiary">{hint}</span>}
      </span>
      <span className="ml-auto min-w-0 text-body text-text-muted">{children}</span>
    </div>
  )
}
