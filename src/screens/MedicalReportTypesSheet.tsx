import { SheetLoader } from '../components/SheetLoader'
import { ConfigListEditor } from '../components/ConfigListEditor'
import { ColorPicker } from '../components/ColorPicker'
import { useAuth } from '../auth/AuthProvider'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { countReportsByType, reassignReportType } from '../data/medical'
import { bumpMedical } from '../lib/medical-refresh'
import { REPORT_TYPE_COLORS } from '../constants/medical'
import {
  addReportType,
  effectiveReportTypes,
  removeReportType,
  renameReportType,
  reorderReportTypes,
  reportTypeColor,
} from '../lib/medical-config'

/**
 * Medical → Report Types: add / rename / delete / reorder the owner's report-type list, stored on
 * `profile.medical_report_types`. Report type is required on every report, so the last value can't be
 * deleted; deleting an in-use value reassigns its reports to a chosen value first.
 */
export function MedicalReportTypesSheet() {
  const { session } = useAuth()
  const { profile, loading, save } = useProfileEditor()
  const userId = session?.user.id

  return (
    <SheetLoader
      label="Report Types"
      title="Report Types"
      loading={loading}
      data={profile}
      errorText="Couldn’t load report types."
    >
      {(prof) => {
        const list = effectiveReportTypes(prof.medical_report_types)
        return (
          <ConfigListEditor
            list={list}
            noun="type"
            itemNoun="report"
            userId={userId}
            persist={(next) => void save({ medical_report_types: next })}
            add={addReportType}
            rename={renameReportType}
            remove={removeReportType}
            reorder={reorderReportTypes}
            count={(key) => countReportsByType(userId!, key)}
            reassign={(from, to) => reassignReportType(userId!, from, to)}
            onChanged={bumpMedical}
            rowExtra={(entry, update) => (
              <ColorPicker
                value={entry.color ?? reportTypeColor(list, entry.key)}
                onChange={(color) => update({ color })}
                options={REPORT_TYPE_COLORS}
                ariaLabel={`Colour for ${entry.label}`}
              />
            )}
          />
        )
      }}
    </SheetLoader>
  )
}
