import {
  PALETTE_BLUE,
  PALETTE_CYAN,
  PALETTE_EMERALD,
  PALETTE_GOLD,
  PALETTE_MAGENTA,
} from './palette'

/**
 * Accent colors for the collapsible sections on the Literature Poem/Poet detail screens — a colored
 * left stripe + tinted header, consumed by the shared `Collapsible` component's `color` prop. Keyed
 * by the poem field / writer section. Consecutive sections use well-separated hues so the adjacent
 * stripes stay distinguishable.
 */
export const LITERATURE_SECTION_COLOR = {
  content: PALETTE_GOLD, // 原文 (always shown)
  translation: PALETTE_BLUE, // 譯文
  remark: PALETTE_EMERALD, // 註釋
  shangxi: PALETTE_MAGENTA, // 賞析
  bio: PALETTE_CYAN, // 作者簡介
  works: PALETTE_GOLD, // 作品 (always shown)
} as const
