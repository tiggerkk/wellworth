import { useNavigate } from 'react-router'
import { IconChevronLeft, IconChevronRight, IconUpload } from '@tabler/icons-react'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Travel Settings. M5 adds the **Expense Categories** editor (Quotes pattern). A single
 * **Enable JSON / CSV Import** toggle (mirrors Medical) surfaces BOTH importers (JSON Trips +
 * CSV Expenses). Per-trip FX overrides live in the trip's Expenses tab (where they're actionable),
 * not here.
 */
export function TravelSettings() {
  const navigate = useNavigate()
  const openSheet = useSheetNavigate()
  const { profile, loading, save } = useProfileEditor()

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <header className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="text-text-secondary"
        >
          <IconChevronLeft size={22} />
        </button>
        <h1 className="text-title font-medium text-text-primary">Travel Settings</h1>
      </header>

      <SectionCard title="Entry Form">
        <button
          onClick={() => openSheet(routes.travel.settingsVisible)}
          className="w-full"
        >
          <FieldRow label="Visible Fields">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Expenses">
        <button
          onClick={() => openSheet(routes.travel.settingsCategories)}
          className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-input/40"
        >
          <span className="text-body text-text-primary">Expense Categories</span>
          <IconChevronRight size={18} className="text-text-secondary" />
        </button>
      </SectionCard>

      {loading && <p className="text-body text-text-secondary">Loading…</p>}
      {!loading && !profile && (
        <p className="text-body text-danger">Couldn’t load your profile.</p>
      )}
      {profile && <ImportSection profile={profile} save={save} openSheet={openSheet} />}
    </div>
  )
}

function ImportSection({
  profile,
  save,
  openSheet,
}: {
  profile: Tables<'profile'>
  save: SaveFn
  openSheet: (to: string) => void
}) {
  return (
    <SectionCard title="Import">
      <FieldRow label="Enable Bulk Trips Import">
        <Toggle
          checked={profile.travel_importer_enabled}
          onChange={(on) => void save({ travel_importer_enabled: on })}
          label="Enable Bulk Trips Import"
        />
      </FieldRow>
      {profile.travel_importer_enabled ? (
        <>
          <button
            onClick={() => openSheet(routes.travel.importTrips)}
            className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-body text-accent last:border-b-0 active:bg-input/40"
          >
            <IconUpload size={18} /> Import JSON Trips
          </button>
          <button
            onClick={() => openSheet(routes.travel.importExpenses)}
            className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-body text-accent last:border-b-0 active:bg-input/40"
          >
            <IconUpload size={18} /> Import CSV Expenses
          </button>
        </>
      ) : (
        <div className="px-4 py-2 text-caption text-text-tertiary">
          Turn this on to bulk-seed your trips from a JSON / CSV.
        </div>
      )}
    </SectionCard>
  )
}
