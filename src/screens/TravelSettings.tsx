import { useState } from 'react'
import { IconChevronRight, IconUpload } from '@tabler/icons-react'
import { SectionCard } from '../components/SectionCard'
import { SettingsLoader } from '../components/SettingsLoader'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { ImportExportRow } from '../components/ImportExportRow'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { useAuth } from '../auth/AuthProvider'
import { listTripsForExport } from '../data/travel'
import { buildTripsExportData } from '../lib/travel-export'
import { downloadJson } from '../lib/file-export'
import { errorMessage } from '../lib/errors'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Travel-specific settings.
 */
export function TravelSettings() {
  const openSheet = useSheetNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { profile, loading, error, save } = useProfileEditor()

  return (
    <SettingsLoader
      title="Travel Settings"
      loading={loading}
      error={error}
      data={profile}
      errorText="Couldn’t load your profile."
    >
      {(profile) => (
        <Body profile={profile} save={save} openSheet={openSheet} userId={userId} />
      )}
    </SettingsLoader>
  )
}

function Body({
  profile,
  save,
  openSheet,
  userId,
}: {
  profile: Tables<'profile'>
  save: SaveFn
  openSheet: (to: string) => void
  userId: string | undefined
}) {
  const [exportingTrips, setExportingTrips] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function exportTrips() {
    if (!userId) return
    setExportingTrips(true)
    setExportError(null)
    try {
      const bundles = await listTripsForExport(userId)
      const data = buildTripsExportData(bundles)
      const today = new Date().toISOString().slice(0, 10)
      downloadJson(`trips-export-${today}.json`, data)
    } catch (e) {
      setExportError(errorMessage(e, 'Export failed.'))
    } finally {
      setExportingTrips(false)
    }
  }

  return (
    <>
      <SectionCard title="Display">
        <button
          onClick={() => openSheet(routes.travel.settingsVisible)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Visible Fields">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Values">
        <button
          onClick={() => openSheet(routes.travel.settingsCategories)}
          className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-input/40"
        >
          <span className="text-body text-text-primary">Expense Categories</span>
          <IconChevronRight size={18} className="text-text-secondary" />
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable Bulk Trips Import / Export">
          <Toggle
            checked={profile.travel_importer_enabled}
            onChange={(on) => void save({ travel_importer_enabled: on })}
            label="Enable Bulk Trips Import / Export"
          />
        </FieldRow>
        {profile.travel_importer_enabled ? (
          <>
            <ImportExportRow
              importLabel="Import JSON Trips"
              onImport={() => openSheet(routes.travel.importTravel)}
              exportLabel="Export JSON Trips"
              onExport={() => void exportTrips()}
              exporting={exportingTrips}
              exportDisabled={!userId}
            />
            <button
              onClick={() => openSheet(routes.travel.importExpenses)}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-accent last:border-b-0 active:bg-input/40"
            >
              <IconUpload size={18} /> Import CSV Expenses
            </button>
            {exportError && (
              <p className="px-4 py-2 text-caption text-danger">{exportError}</p>
            )}
            <p className="px-4 py-2 text-caption text-text-tertiary">
              No Export CSV Expenses yet — the wide per-category CSV format can't
              losslessly round-trip multiple same-day, same-category expenses.
            </p>
          </>
        ) : (
          <div className="px-4 py-2 text-caption text-text-tertiary">
            Turn this on to bulk-seed your trips from a JSON / CSV.
          </div>
        )}
      </SectionCard>
    </>
  )
}
