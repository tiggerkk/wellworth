import { useState, type ReactNode } from 'react'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import {
  MEDICAL_CATEGORY_COLOR,
  MEDICAL_CATEGORY_LABELS,
  type MedicalCategory,
} from '../lib/medical'

interface MedicalSectionProps {
  category: MedicalCategory
  /** Sections start expanded (the owner reads whole reports); collapse to shorten. */
  defaultOpen?: boolean
  /**
   * `card` — wrap the body in a `surface` card (Report detail, Dashboard latest-values rows).
   * `bare` — colored header bar only; the caller's children are already cards (Edit Report's
   * `MedicalResultCard` stack), so we don't nest a second surface card around them.
   */
  variant?: 'card' | 'bare'
  children: ReactNode
}

/**
 * A collapsible lab-result section with a left chevron (mirrors the Diary group header) and a
 * per-category color accent: a colored left stripe + a tinted header background, both derived from
 * `MEDICAL_CATEGORY_COLOR`. Shared by the read-only Report, the Edit Report form, and the Dashboard.
 */
export function MedicalSection({
  category,
  defaultOpen = true,
  variant = 'card',
  children,
}: MedicalSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const color = MEDICAL_CATEGORY_COLOR[category]

  const Header = (
    <button
      onClick={() => setOpen((o) => !o)}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {open ? (
        <IconChevronDown size={16} className="shrink-0 text-text-tertiary" />
      ) : (
        <IconChevronRight size={16} className="shrink-0 text-text-tertiary" />
      )}
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
        {MEDICAL_CATEGORY_LABELS[category]}
      </span>
    </button>
  )

  if (variant === 'bare') {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="overflow-hidden rounded-card border border-border"
          style={{ borderLeft: `4px solid ${color}` }}
        >
          {Header}
        </div>
        {open && children}
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-surface"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {Header}
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  )
}
