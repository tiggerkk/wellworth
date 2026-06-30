import { VisibleFieldsSheet } from '../components/VisibleFieldsSheet'
import { POEM_VISIBLE_FIELDS } from '../lib/literature'

/** Literature → 可見詩書欄位. Thin wrapper over the shared `VisibleFieldsSheet`; 原文 is always shown. */
export function LiteraturePoemFieldsSheet() {
  return (
    <VisibleFieldsSheet
      title="可見詩書欄位"
      intro="選擇詩詞頁面顯示的欄位。原文一律顯示。"
      fields={POEM_VISIBLE_FIELDS}
      column="literature_poem_visible_fields"
    />
  )
}
