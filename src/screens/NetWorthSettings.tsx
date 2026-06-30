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
 * Net Worth sub-settings: Visible Asset Types (display order/visibility) + the one-time bulk
 * insurance importer toggle. Manual / fund / single-policy imports are always enabled elsewhere.
 */
export function NetWorthSettings() {
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
        <h1 className="text-title font-medium text-text-primary">Net Worth Settings</h1>
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
          onClick={() => openSheet(routes.networth.settingsVisibleAssetTypes)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Visible Asset Types">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
        <button
          onClick={() => openSheet(routes.networth.settingsLiquidAssetTypes)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Liquid Assets">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
        <button
          onClick={() => openSheet(routes.networth.settingsProviders)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Manage Providers">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable Bulk Insurance Import">
          <Toggle
            checked={profile.networth_bulk_insurance_import_enabled}
            onChange={(on) => void save({ networth_bulk_insurance_import_enabled: on })}
            label="Enable Bulk Insurance Import"
          />
        </FieldRow>
        {profile.networth_bulk_insurance_import_enabled ? (
          <button
            onClick={() => openSheet(routes.networth.importInsuranceBulk)}
            className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-accent last:border-b-0 active:bg-input/40"
          >
            <IconUpload size={18} /> Import CSV Insurance
          </button>
        ) : (
          <div className="px-4 py-2 text-caption text-text-tertiary">
            Turn this on to bulk-seed your insurance policy catalogue from a CSV.
          </div>
        )}
      </SectionCard>
    </>
  )
}
