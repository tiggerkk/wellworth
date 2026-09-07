import { useState } from 'react'
import { IconChevronRight, IconRefresh, IconTrash } from '@tabler/icons-react'
import { SettingsLoader } from '../components/SettingsLoader'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { useAuth } from '../auth/AuthProvider'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { ImportExportRow } from '../components/ImportExportRow'
import { clearShowMatchCache, showMatchCacheSize } from '../lib/shows-match-cache'
import { listShows, updateShow } from '../data/show'
import { buildShowsExportRows } from '../lib/shows-export'
import { downloadCsv } from '../lib/file-export'
import { errorMessage } from '../lib/errors'
import { routes } from '../constants/routes'
import {
  bulkRefreshCandidates,
  refreshAllFromTmdb,
  type BulkRefreshOutcome,
} from '../lib/shows-bulk-refresh'
import { bumpShows } from '../lib/shows-refresh'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Shows-specific settings: field visibility, CSV import/export, and bulk TMDB maintenance.
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
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [refreshResults, setRefreshResults] = useState<BulkRefreshOutcome[] | null>(null)

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

  async function refreshAll() {
    if (!userId) return
    setRefreshing(true)
    setRefreshResults(null)
    try {
      const shows = await listShows(userId)
      const candidates = bulkRefreshCandidates(shows)
      setRefreshProgress({ done: 0, total: candidates.length })
      const results = await refreshAllFromTmdb(candidates, updateShow, (done, total) =>
        setRefreshProgress({ done, total }),
      )
      if (results.some((r) => r.changed)) bumpShows()
      setRefreshResults(results)
    } finally {
      setRefreshing(false)
      setRefreshProgress(null)
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

      <SectionCard title="Maintenance">
        <button
          onClick={() => void refreshAll()}
          disabled={refreshing || !userId}
          className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-accent last:border-b-0 active:bg-input/40 disabled:opacity-40"
        >
          <IconRefresh size={18} className={refreshing ? 'animate-spin' : ''} />
          {refreshing
            ? refreshProgress
              ? `Refreshing… (${refreshProgress.done}/${refreshProgress.total})`
              : 'Refreshing…'
            : 'Refresh All from TMDB'}
        </button>
        <p className="px-4 py-2 text-caption text-text-tertiary">
          Re-checks every Want / Watching TV show and Documentary against TMDB for new
          seasons or episodes. Movies aren’t included — they have no seasons/episodes to
          check for.
        </p>
        {refreshResults && <BulkRefreshResults results={refreshResults} />}
      </SectionCard>
    </>
  )
}

/** Result list for "Refresh All from TMDB": only shows titles that actually changed or gained
 * new episodes/seasons, plus any that errored — a large "nothing to report" library stays quiet. */
function BulkRefreshResults({ results }: { results: BulkRefreshOutcome[] }) {
  const withNews = results.filter((r) => r.newEpisodesAvailable || r.error)
  const changedCount = results.filter((r) => r.changed).length

  return (
    <div className="border-t border-border px-4 py-2">
      <p className="text-caption text-text-secondary">
        {results.length} checked · {changedCount} updated
        {withNews.length > 0 ? ` · ${withNews.length} to review` : ''}
      </p>
      {withNews.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {withNews.map((r) => (
            <li key={r.show.id} className="text-caption text-text-secondary">
              <span className="text-text-primary">{r.show.title}</span>
              {r.error ? (
                <span className="text-danger"> — {r.error}</span>
              ) : (
                <span className="text-positive"> — new episodes available</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
