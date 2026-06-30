import { VisibleFieldsSheet } from '../components/VisibleFieldsSheet'
import { WRITER_VISIBLE_FIELDS } from '../lib/literature'

/** Literature → 可見名家欄位. Thin wrapper over the shared `VisibleFieldsSheet`; 作品 is always shown. */
export function LiteratureWriterFieldsSheet() {
  return (
    <VisibleFieldsSheet
      title="可見名家欄位"
      intro="選擇名家頁面顯示的欄位。作品一律顯示。"
      fields={WRITER_VISIBLE_FIELDS}
      column="literature_writer_visible_fields"
    />
  )
}
