import { VisibleFieldsSheet } from '../components/VisibleFieldsSheet'
import { MEDICAL_VISIBLE_FIELDS } from '../lib/medical'

/** Medical → Visible Fields. Thin wrapper over the shared `VisibleFieldsSheet`. */
export function MedicalFieldsSheet() {
  return (
    <VisibleFieldsSheet
      intro="Choose which fields appear on the New/Edit Medical form. Date and Type are always shown."
      fields={MEDICAL_VISIBLE_FIELDS}
      column="medical_visible_fields"
    />
  )
}
