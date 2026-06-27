import type { ComponentType } from 'react'
import {
  IconChevronDown,
  IconChevronRight,
  IconClipboard,
  IconCopy,
  IconPlus,
} from '@tabler/icons-react'
import { IconAction } from './IconAction'
import { ConfirmDeleteAction } from './ConfirmDeleteAction'

interface GroupHeaderProps {
  title: string
  /** Leading category icon + its color (from the group's config). */
  Icon: ComponentType<{ size?: number; className?: string }>
  iconClass: string
  /** kcal subtotal; negative (activities) renders coral. */
  kcal: number
  /** Number of logged entries in this group — gates Delete/Copy. */
  count: number
  /** Whether the clipboard holds any item — gates (and tints) Paste. */
  canPaste: boolean
  expanded: boolean
  onToggle: () => void
  onAdd: () => void
  onDelete: () => void
  onCopy: () => void
  onPaste: () => void
}

/**
 * Collapsible diary-group header. Left-to-right: expand chevron · category icon · title · kcal
 * subtotal · ⟨spacer⟩ · Delete · Copy · Paste · Add — mirroring the Edit Trip day header.
 * Delete/Copy are disabled on an empty group; Paste lights teal (`text-positive`) only when the
 * clipboard holds items.
 */
export function GroupHeader({
  title,
  Icon,
  iconClass,
  kcal,
  count,
  canPaste,
  expanded,
  onToggle,
  onAdd,
  onDelete,
  onCopy,
  onPaste,
}: GroupHeaderProps) {
  const negative = kcal < 0
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <button onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
        {expanded ? (
          <IconChevronDown size={18} className="shrink-0 text-text-tertiary" />
        ) : (
          <IconChevronRight size={18} className="shrink-0 text-text-tertiary" />
        )}
        <Icon size={18} className={`shrink-0 ${iconClass}`} />
        <span className="truncate text-[15px] font-medium text-text-primary">
          {title}
        </span>
        <span
          className={`shrink-0 text-[13px] ${negative ? 'text-accent' : 'text-text-secondary'}`}
        >
          {Math.round(kcal)} kcal
        </span>
      </button>
      <div className="flex-1" />
      <ConfirmDeleteAction
        label={`Delete all in ${title}`}
        onDelete={onDelete}
        disabled={count === 0}
      />
      <IconAction
        Icon={IconCopy}
        label={`Copy ${title}`}
        onClick={onCopy}
        disabled={count === 0}
      />
      <IconAction
        Icon={IconClipboard}
        label={`Paste into ${title}`}
        onClick={onPaste}
        disabled={!canPaste}
        tone="positive"
      />
      <IconAction
        Icon={IconPlus}
        label={`Add to ${title}`}
        onClick={onAdd}
        tone="positive"
        stroke={2.25}
      />
    </div>
  )
}
