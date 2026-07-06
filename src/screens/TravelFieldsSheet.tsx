import { VisibleFieldsSheet } from '../components/VisibleFieldsSheet'
import { TRIP_VISIBLE_FIELDS } from '../lib/travel'

/** Travel → Visible Fields. Thin wrapper over the shared `VisibleFieldsSheet`. */
export function TravelFieldsSheet() {
  return (
    <VisibleFieldsSheet
      intro="Choose which fields appear on the New/Edit Trip form. Trip Name, Default Currency and Status are always shown."
      fields={TRIP_VISIBLE_FIELDS}
      column="travel_visible_fields"
    />
  )
}
