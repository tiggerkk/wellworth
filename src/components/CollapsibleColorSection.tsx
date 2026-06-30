import { useState, type ReactNode } from 'react'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'

interface CollapsibleColorSectionProps {
  title: string
  /** Accent color (CSS value, e.g. a `var(--color-lit-*)` token) for the left stripe + tinted header. */
  color: string
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * A collapsible card with a colored left stripe + tinted header and a left chevron — the shared
 * Net Worth Monthly Entry / `MedicalSection` pattern, generic over an accent color (no module
 * coupling). The header label is a readable `text-body` (not the 11px section caption) to suit CJK
 * titles. Used by the Literature Poem/Poet detail sections.
 */
export function CollapsibleColorSection({
  title,
  color,
  defaultOpen = true,
  children,
}: CollapsibleColorSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-surface"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        {open ? (
          <IconChevronDown size={18} className="shrink-0 text-text-secondary" />
        ) : (
          <IconChevronRight size={18} className="shrink-0 text-text-secondary" />
        )}
        <span className="min-w-0 flex-1 text-body font-medium text-text-primary">
          {title}
        </span>
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  )
}
