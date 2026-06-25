import { VisibleFieldsSheet } from '../components/VisibleFieldsSheet'
import { SHOW_ENTRY_FIELDS } from '../lib/shows'

/**
 * Shows → Visible Fields. Thin wrapper over the shared `VisibleFieldsSheet`; Poster URL is an
 * `extra` (its own `show_poster_url_visible` boolean, default-off) placed in form-order position.
 */
export function ShowsFieldsSheet() {
  return (
    <VisibleFieldsSheet
      intro="Choose which fields appear on the New/Edit Show form. Type, Title and Status (and Search) are always shown."
      fields={SHOW_ENTRY_FIELDS}
      column="show_visible_fields"
      extras={[
        { label: 'Poster URL', column: 'show_poster_url_visible', afterKey: 'episodes' },
      ]}
    />
  )
}
