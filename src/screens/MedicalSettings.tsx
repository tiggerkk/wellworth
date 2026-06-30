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
 * Medical sub-settings (reached from the Settings tab in the Medical bottom nav): Dashboard tracked
 * tests (M4), drag-to-reorder Display Order (M5), the biometric/PIN Lock (M6), Entry field
 * visibility, and the structured importer toggle. Mirrors `ShowsSettings`.
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
        <h1 className="text-title font-medium text-text-primary">Medical Settings</h1>
      </header>
      {loading && <p className="text-body text-text-secondary">Loading…</p>}
      {!loading && !profile && (
        <p className="text-body text-danger">Couldn’t load your profile.</p>
      )}
      {profile && <Body profile={profile} save={save} />}
    </div>
  )
}

function Body({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  const openSheet = useSheetNavigate()

  return (
    <>
      <SectionCard title="Display">
        <button
          onClick={() => openSheet(routes.medical.settingsTracked)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Tracked Tests" hint="(Dashboard)">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
        <button
          onClick={() => openSheet(routes.medical.settingsOrder)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Tests Display Order" hint="(Dashboard, Report & Entry)">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Report / Entry Form">
        <button
          onClick={() => openSheet(routes.medical.settingsVisible)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Visible Fields">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable Medical Import">
          <Toggle
            checked={profile.medical_importer_enabled}
            onChange={(on) => void save({ medical_importer_enabled: on })}
            label="Enable Medical Import"
          />
        </FieldRow>
        {profile.medical_importer_enabled ? (
          <button
            onClick={() => openSheet(routes.medical.import)}
            className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-accent last:border-b-0 active:bg-input/40"
          >
            <IconUpload size={18} /> Import JSON / CSV Medical
          </button>
        ) : (
          <div className="px-4 py-2 text-caption text-text-tertiary">
            Turn this on to import a report from a JSON/CSV file (generated outside the
            app from a report PDF by any AI tool).
          </div>
        )}
      </SectionCard>

      <SectionCard title="Security">
        <button
          onClick={() => openSheet(routes.medical.settingsLock)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Lock">
            <span className="flex items-center gap-1">
              {profile.medical_lock_enabled ? 'On' : 'Off'}
              <IconChevronRight size={18} className="text-text-tertiary" />
            </span>
          </FieldRow>
        </button>
      </SectionCard>
    </>
  )
}
