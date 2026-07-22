import { DYNASTY_CHIP } from '../constants/dynasty'
import { LabelChip } from './LabelChip'

/** Dynasty badge (e.g. 先秦, 唐代). Conceptually distinct from a `StatusChip` — dynasty is a descriptive
 *  era tag, not a workflow status — so it renders via `LabelChip`. Shared by Poems (card + detail + poet
 *  detail) and by Books/Shows rows, so the visual stays identical everywhere a dynasty shows up. `shrink-0`
 *  keeps it from compressing when it sits next to a truncating title in a flex row. */
export function DynastyChip({ dynasty }: { dynasty: string }) {
  return <LabelChip label={dynasty} className={`shrink-0 ${DYNASTY_CHIP}`} />
}
