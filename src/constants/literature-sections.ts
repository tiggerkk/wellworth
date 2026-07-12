/**
 * Accent colors for the collapsible sections on the Literature Poem/Poet detail screens — a colored
 * left stripe + tinted header, consumed by the shared `Collapsible` component's `color` prop. Keyed
 * by the poem field / writer section; values are the design-system `--color-lit-*` tokens (see
 * `src/index.css`). Consecutive sections use well-separated hues so the adjacent stripes stay
 * distinguishable.
 */
export const LITERATURE_SECTION_COLOR = {
  content: 'var(--color-lit-original)', // 原文 (always shown)
  translation: 'var(--color-lit-translation)', // 譯文
  remark: 'var(--color-lit-remark)', // 註釋
  shangxi: 'var(--color-lit-shangxi)', // 賞析
  bio: 'var(--color-lit-bio)', // 作者簡介
  works: 'var(--color-lit-works)', // 作品 (always shown)
} as const
