import { useState } from 'react'
import { IconChevronRight, IconTrash } from '@tabler/icons-react'
import { SettingsLoader } from '../components/SettingsLoader'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { useAuth } from '../auth/AuthProvider'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { ImportExportRow } from '../components/ImportExportRow'
import { clearShowMatchCache, showMatchCacheSize } from '../lib/shows-match-cache'
import { listShows } from '../data/show'
import { buildShowsExportRows } from '../lib/shows-export'
import { downloadCsv } from '../lib/file-export'
import { errorMessage } from '../lib/errors'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Shows-specific settings.
 */
export function ShowsSettings() {
  const { profile, loading, error, save } = useProfileEditor()

  return (
    <SettingsLoader
      title="Shows Settings"
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
  const [cacheCount, setCacheCount] = useState(() => showMatchCacheSize())
  const [exportingShows, setExportingShows] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function exportShows() {
    if (!userId) return
    setExportingShows(true)
    setExportError(null)
    try {
      const shows = await listShows(userId)
      const rows = buildShowsExportRows(shows)
      const today = new Date().toISOString().slice(0, 10)
      downloadCsv(`shows-export-${today}.csv`, rows)
    } catch (e) {
      setExportError(errorMessage(e, 'Export failed.'))
    } finally {
      setExportingShows(false)
    }
  }

  return (
    <>
      <SectionCard title="Display">
        <button
          onClick={() => openSheet(routes.shows.settingsVisible)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Visible Fields">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable Bulk Shows Import / Export">
          <Toggle
            checked={profile.show_importer_enabled}
            onChange={(on) => void save({ show_importer_enabled: on })}
            label="Enable Bulk Shows Import / Export"
          />
        </FieldRow>
        {profile.show_importer_enabled ? (
          <>
            <ImportExportRow
              importLabel="Import CSV Shows"
              onImport={() => openSheet(routes.shows.import)}
              exportLabel="Export CSV Shows"
              onExport={() => void exportShows()}
              exporting={exportingShows}
              exportDisabled={!userId}
            />
            <button
              onClick={() => {
                clearShowMatchCache()
                setCacheCount(0)
              }}
              disabled={cacheCount === 0}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-text-secondary last:border-b-0 active:bg-input/40 disabled:opacity-40"
            >
              <IconTrash size={18} />
              Clear Import Match Cache{cacheCount ? ` (${cacheCount})` : ''}
            </button>
            {exportError && (
              <p className="px-4 py-2 text-caption text-danger">{exportError}</p>
            )}
            <p className="px-4 py-2 text-caption text-text-tertiary">
              The importer remembers each title’s TMDB match in this browser so
              re-importing the same CSV resolves instantly. Clearing it forces a fresh
              lookup next import. It’s not affected by a database reset.
            </p>
          </>
        ) : (
          <div className="px-4 py-2 text-caption text-text-tertiary">
            Turn this on to bulk-seed your library from a CSV.
          </div>
        )}
      </SectionCard>
    </>
  )
}
