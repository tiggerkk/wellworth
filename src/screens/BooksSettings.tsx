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
import { bookMatchCacheSize, clearBookMatchCache } from '../lib/books-match-cache'
import { listBooks } from '../data/book'
import { buildBooksExportRows } from '../lib/books-export'
import { downloadCsv } from '../lib/file-export'
import { errorMessage } from '../lib/errors'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Books-specific settings.
 */
export function BooksSettings() {
  const { profile, loading, error, save } = useProfileEditor()

  return (
    <SettingsLoader
      title="Books Settings"
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
  const [cacheCount, setCacheCount] = useState(() => bookMatchCacheSize())
  const [exportingBooks, setExportingBooks] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function exportBooks() {
    if (!userId) return
    setExportingBooks(true)
    setExportError(null)
    try {
      const books = await listBooks(userId)
      const rows = buildBooksExportRows(books)
      const today = new Date().toISOString().slice(0, 10)
      downloadCsv(`books-export-${today}.csv`, rows)
    } catch (e) {
      setExportError(errorMessage(e, 'Export failed.'))
    } finally {
      setExportingBooks(false)
    }
  }

  return (
    <>
      <SectionCard title="Display">
        <button
          onClick={() => openSheet(routes.books.settingsVisible)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Visible Fields">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable Bulk Books Import / Export">
          <Toggle
            checked={profile.book_importer_enabled}
            onChange={(on) => void save({ book_importer_enabled: on })}
            label="Enable Bulk Books Import / Export"
          />
        </FieldRow>
        {profile.book_importer_enabled ? (
          <>
            <ImportExportRow
              importLabel="Import CSV Books"
              onImport={() => openSheet(routes.books.import)}
              exportLabel="Export CSV Books"
              onExport={() => void exportBooks()}
              exporting={exportingBooks}
              exportDisabled={!userId}
            />
            <button
              onClick={() => {
                clearBookMatchCache()
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
              The importer remembers each book’s Google Books match in this browser so
              re-importing the same CSV doesn’t re-query (and won’t hit the daily quota).
              Clearing it forces a fresh lookup next import. It’s not affected by a
              database reset.
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
