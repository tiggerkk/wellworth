import { DYNASTY_CHIP } from '../constants/dynasty'

interface DynastyChipProps {
  dynasty: string
  className?: string
}

/** Dynasty badge (e.g. 先秦, 唐代). Conceptually distinct from a `StatusChip` — dynasty is a descriptive
 *  era tag, not a workflow status — so it's its own component. Shared by Poems (card + detail + poet detail)
 *  and by Books/Shows rows, so the visual stays identical everywhere a dynasty shows up. */
export function DynastyChip({ dynasty, className = '' }: DynastyChipProps) {
  return (
    <span
      className={`shrink-0 rounded-pill px-1.5 py-0.5 text-section ${DYNASTY_CHIP} ${className}`}
    >
      {dynasty}
    </span>
  )
}
