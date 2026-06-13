import {
  IconBarbell,
  IconKarate,
  IconRun,
  IconStretching,
  IconStretching2,
  IconSwimming,
  IconWalk,
  IconYoga,
  type Icon,
} from '@tabler/icons-react'

/**
 * Maps the Tabler component-name string stored in `activity.icon` to the imported
 * component. Only the icons the app uses are imported (tree-shaking safe — do NOT use
 * `import * as TablerIcons`). Null/unknown falls back to DEFAULT_ACTIVITY_ICON.
 */
export const ACTIVITY_ICONS: Record<string, Icon> = {
  IconKarate,
  IconStretching,
  IconStretching2,
  IconYoga,
  IconBarbell,
  IconSwimming,
  IconWalk,
  IconRun,
}

export const DEFAULT_ACTIVITY_ICON: Icon = IconRun

export function resolveActivityIcon(name: string | null): Icon {
  return (name && ACTIVITY_ICONS[name]) || DEFAULT_ACTIVITY_ICON
}
