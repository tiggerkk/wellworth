import type { ComponentType } from 'react'
import { IconChevronDown, IconChevronRight, IconPlus } from '@tabler/icons-react'

interface GroupHeaderProps {
  title: string
  /** Leading category icon + its color (from the group's config). */
  Icon: ComponentType<{ size?: number; className?: string }>
  iconClass: string
  /** kcal subtotal; negative (activities) renders coral. */
  kcal: number
  expanded: boolean
  onToggle: () => void
  onAdd: () => void
}

/** Collapsible diary-group header: expand chevron + category icon + title + kcal · green `+`. */
export function GroupHeader({
  title,
  Icon,
  iconClass,
  kcal,
  expanded,
  onToggle,
  onAdd,
}: GroupHeaderProps) {
  const negative = kcal < 0
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <button onClick={onToggle} className="flex flex-1 items-center gap-2 text-left">
        {expanded ? (
          <IconChevronDown size={18} className="shrink-0 text-text-tertiary" />
        ) : (
          <IconChevronRight size={18} className="shrink-0 text-text-tertiary" />
        )}
        <Icon size={18} className={`shrink-0 ${iconClass}`} />
        <span className="flex-1 text-[15px] font-medium text-text-primary">{title}</span>
        <span
          className={`text-[13px] ${negative ? 'text-accent' : 'text-text-secondary'}`}
        >
          {Math.round(kcal)} kcal
        </span>
      </button>
      <button
        onClick={onAdd}
        aria-label={`Add to ${title}`}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-positive"
      >
        <IconPlus size={20} stroke={2.25} />
      </button>
    </div>
  )
}
