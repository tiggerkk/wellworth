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
 * Shows-specific sub-settings (Entry field visibility + the CSV importer toggle). Reached from a
 * gear in the Shows headers — mirrors the Wellness Settings split. App-wide settings live in the
 * global Settings screen at the Home level.
 */
export function ShowsSettings() {
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
        <h1 className="text-lg font-medium text-text-primary">Shows Settings</h1>
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
      <SectionCard title="Entry Form">
        <button
          onClick={() => openSheet(routes.shows.settingsVisible)}
          className="w-full"
        >
          <FieldRow label="Visible Fields">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable CSV import">
          <Toggle
            checked={profile.show_importer_enabled}
            onChange={(on) => void save({ show_importer_enabled: on })}
            label="Enable CSV import"
          />
        </FieldRow>
        {profile.show_importer_enabled ? (
          <button
            onClick={() => openSheet(routes.shows.import)}
            className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-[15px] text-accent last:border-b-0 active:bg-input/40"
          >
            <IconUpload size={18} /> Import CSV…
          </button>
        ) : (
          <div className="px-4 py-2 text-xs text-text-tertiary">
            Turn this on to bulk-seed your library from a CSV (one-off).
          </div>
        )}
      </SectionCard>
    </>
  )
}
