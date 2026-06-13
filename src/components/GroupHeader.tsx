import { IconChevronDown, IconChevronRight, IconPlus } from '@tabler/icons-react'

interface GroupHeaderProps {
  title: string
  /** kcal subtotal; negative (activities) renders coral. */
  kcal: number
  expanded: boolean
  onToggle: () => void
  onAdd: () => void
}

/** Collapsible diary-group header: green `+`, title, kcal subtotal, chevron. */
export function GroupHeader({
  title,
  kcal,
  expanded,
  onToggle,
  onAdd,
}: GroupHeaderProps) {
  const negative = kcal < 0
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <button
        onClick={onAdd}
        aria-label={`Add to ${title}`}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-positive"
      >
        <IconPlus size={20} stroke={2.25} />
      </button>
      <button onClick={onToggle} className="flex flex-1 items-center gap-2 text-left">
        <span className="flex-1 text-[15px] font-medium text-text-primary">{title}</span>
        <span
          className={`text-[13px] ${negative ? 'text-accent' : 'text-text-secondary'}`}
        >
          {Math.round(kcal)} kcal
        </span>
        {expanded ? (
          <IconChevronDown size={18} className="text-text-tertiary" />
        ) : (
          <IconChevronRight size={18} className="text-text-tertiary" />
        )}
      </button>
    </div>
  )
}
