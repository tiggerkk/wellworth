import { useState } from 'react'
import { IconChevronRight, IconUpload } from '@tabler/icons-react'
import { SettingsLoader } from '../components/SettingsLoader'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { useAuth } from '../auth/AuthProvider'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { ImportExportRow } from '../components/ImportExportRow'
import { listJournalEntries } from '../data/journal'
import { buildJournalExportRows } from '../lib/journal-export'
import { downloadCsv } from '../lib/file-export'
import { errorMessage } from '../lib/errors'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Quotes & Journal-specific settings (Entry field visibility + Journal Moods + Source Types +
 * Categories + CSV importer).
 */
export function QuotesSettings() {
  const { profile, loading, error, save } = useProfileEditor()

  return (
    <SettingsLoader
      title="Quotes & Journal Settings"
      loading={loading}
      error={error}
      data={profile}
      errorText="Couldn’t load your profile."
    >
      {(profile) => <Body profile={profile} save={save} />}
    </SettingsLoader>
  )
}

function Body({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  const openSheet = useSheetNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const [exportingJournal, setExportingJournal] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function exportJournal() {
    if (!userId) return
    setExportingJournal(true)
    setExportError(null)
    try {
      const entries = await listJournalEntries(userId)
      const rows = buildJournalExportRows(entries)
      const today = new Date().toISOString().slice(0, 10)
      downloadCsv(`journal-export-${today}.csv`, rows)
    } catch (e) {
      setExportError(errorMessage(e, 'Export failed.'))
    } finally {
      setExportingJournal(false)
    }
  }

  return (
    <>
      <SectionCard title="Display">
        <button
          onClick={() => openSheet(routes.quotes.settingsVisible)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Visible Fields" hint="(Quote Entry)">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Journal Values">
        <button
          onClick={() => openSheet(routes.quotes.settingsMoods)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Moods">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Quotes Values">
        <button
          onClick={() => openSheet(routes.quotes.settingsSourceTypes)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Source Types">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
        <button
          onClick={() => openSheet(routes.quotes.settingsCategories)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Categories">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable Bulk Quotes Import / Export">
          <Toggle
            checked={profile.quote_importer_enabled}
            onChange={(on) => void save({ quote_importer_enabled: on })}
            label="Enable Bulk Quotes Import / Export"
          />
        </FieldRow>
        {profile.quote_importer_enabled ? (
          <>
            <ImportExportRow
              importLabel="Import CSV Journal"
              onImport={() => openSheet(routes.quotes.importJournal)}
              exportLabel="Export CSV Journal"
              onExport={() => void exportJournal()}
              exporting={exportingJournal}
              exportDisabled={!userId}
            />
            <button
              onClick={() => openSheet(routes.quotes.import)}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-accent last:border-b-0 active:bg-input/40"
            >
              <IconUpload size={18} /> Import CSV Quotes
            </button>
            {exportError && (
              <p className="px-4 py-2 text-caption text-danger">{exportError}</p>
            )}
          </>
        ) : (
          <div className="px-4 py-2 text-caption text-text-tertiary">
            Turn this on to bulk-seed your library or journal from a CSV.
          </div>
        )}
      </SectionCard>
    </>
  )
}
