import { useState, type ReactNode } from 'react'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

/** A `surface` card with a collapsible uppercase-label header (nutrient-facts groups). */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
          {title}
        </span>
        {open ? (
          <IconChevronDown size={16} className="text-text-tertiary" />
        ) : (
          <IconChevronRight size={16} className="text-text-tertiary" />
        )}
      </button>
      {open && <div className="border-t border-border px-4 py-1">{children}</div>}
    </div>
  )
}
