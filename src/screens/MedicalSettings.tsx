import { useNavigate } from 'react-router'
import { IconChevronLeft, IconChevronRight, IconUpload } from '@tabler/icons-react'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Medical sub-settings (reached from the Settings tab in the Medical bottom nav): Entry field
 * visibility + the structured importer toggle. Tracked-tests + drag-to-reorder + the biometric lock
 * land in M4–M6. Mirrors `ShowsSettings`.
 */
export function MedicalSettings() {
  const { profile, loading, save } = useProfileEditor()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-bg/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="-ml-1 p-1 text-text-secondary"
        >
          <IconChevronLeft size={22} />
        </button>
        <h1 className="text-lg font-medium text-text-primary">Medical Settings</h1>
      </header>
      {loading && <p className="text-sm text-text-secondary">Loading…</p>}
      {!loading && !profile && (
        <p className="text-sm text-danger">Couldn’t load your profile.</p>
      )}
      {profile && <Body profile={profile} save={save} />}
    </div>
  )
}

function Body({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  const openSheet = useSheetNavigate()

  return (
    <>
      <SectionCard title="Report Form">
        <button
          onClick={() => openSheet(routes.medical.settingsVisible)}
          className="w-full"
        >
          <FieldRow label="Visible Fields">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable structured import">
          <Toggle
            checked={profile.medical_importer_enabled}
            onChange={(on) => void save({ medical_importer_enabled: on })}
            label="Enable structured import"
          />
        </FieldRow>
        {profile.medical_importer_enabled ? (
          <button
            onClick={() => openSheet(routes.medical.import)}
            className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-[15px] text-accent last:border-b-0 active:bg-input/40"
          >
            <IconUpload size={18} /> Import JSON / CSV…
          </button>
        ) : (
          <div className="px-4 py-2 text-xs text-text-tertiary">
            Turn this on to import a report from a JSON/CSV file (generated outside the
            app from a report PDF by any AI tool).
          </div>
        )}
      </SectionCard>
    </>
  )
}
