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
 * Quotes-specific sub-settings (Entry field visibility + the CSV importer toggle). Reached from a
 * gear in the Quotes headers — mirrors the Wellness/Shows/Books Settings split. App-wide settings
 * live in the global Settings screen at the Home level. The importer launcher lands in M7; for now
 * the toggle just persists `quote_importer_enabled`.
 */
export function QuotesSettings() {
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
        <h1 className="text-title font-medium text-text-primary">Quotes Settings</h1>
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
      <SectionCard title="Entry Form">
        <button
          onClick={() => openSheet(routes.quotes.settingsVisible)}
          className="w-full"
        >
          <FieldRow label="Visible Fields">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Values">
        <button
          onClick={() => openSheet(routes.quotes.settingsSourceTypes)}
          className="w-full"
        >
          <FieldRow label="Source Types">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
        <button
          onClick={() => openSheet(routes.quotes.settingsCategories)}
          className="w-full"
        >
          <FieldRow label="Categories">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable Bulk Quotes Import">
          <Toggle
            checked={profile.quote_importer_enabled}
            onChange={(on) => void save({ quote_importer_enabled: on })}
            label="Enable Bulk Quotes Import"
          />
        </FieldRow>
        {profile.quote_importer_enabled ? (
          <button
            onClick={() => openSheet(routes.quotes.import)}
            className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-body text-accent last:border-b-0 active:bg-input/40"
          >
            <IconUpload size={18} /> Import CSV Quotes
          </button>
        ) : (
          <div className="px-4 py-2 text-caption text-text-tertiary">
            Turn this on to bulk-seed your library from a CSV.
          </div>
        )}
      </SectionCard>
    </>
  )
}
