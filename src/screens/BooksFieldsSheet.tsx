import { VisibleFieldsSheet } from '../components/VisibleFieldsSheet'
import { BOOK_VISIBLE_FIELDS } from '../lib/books'

/** Books → Visible Fields. Thin wrapper over the shared `VisibleFieldsSheet`. */
export function BooksFieldsSheet() {
  return (
    <VisibleFieldsSheet
      intro="Choose which fields appear on the New/Edit Book form. Title and Status (and Search) are always shown."
      fields={BOOK_VISIBLE_FIELDS}
      column="book_visible_fields"
    />
  )
}
