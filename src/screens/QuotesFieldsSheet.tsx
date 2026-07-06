import { VisibleFieldsSheet } from '../components/VisibleFieldsSheet'
import { QUOTE_VISIBLE_FIELDS } from '../lib/quotes'

/** Quotes → Visible Fields. Thin wrapper over the shared `VisibleFieldsSheet`. */
export function QuotesFieldsSheet() {
  return (
    <VisibleFieldsSheet
      intro="Choose which fields appear on the New/Edit Quote form. Quote and Category are always shown."
      fields={QUOTE_VISIBLE_FIELDS}
      column="quote_visible_fields"
    />
  )
}
