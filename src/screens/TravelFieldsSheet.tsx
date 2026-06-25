import { VisibleFieldsSheet } from '../components/VisibleFieldsSheet'
import { TRIP_ENTRY_FIELDS } from '../lib/travel'

/** Travel → Visible Fields. Thin wrapper over the shared `VisibleFieldsSheet`. */
export function TravelFieldsSheet() {
  return (
    <VisibleFieldsSheet
      intro="Choose which fields appear on the New/Edit Trip form. Trip Name, Base Currency and Status are always shown."
      fields={TRIP_ENTRY_FIELDS}
      column="travel_visible_fields"
    />
  )
}
