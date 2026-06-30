import { useState } from 'react'
import { IconChevronRight, IconTrash, IconUpload } from '@tabler/icons-react'
import { SettingsLayout } from '../components/SettingsLayout'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { bookMatchCacheSize, clearBookMatchCache } from '../lib/book-match-cache'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Books-specific sub-settings (Entry field visibility + the CSV importer toggle). Reached from a
 * gear in the Books headers — mirrors the Wellness/Shows Settings split. App-wide settings live in
 * the global Settings screen at the Home level.
 */
export function BooksSettings() {
  const { profile, loading, save } = useProfileEditor()

  return (
    <SettingsLayout title="Books Settings">
      {loading && <p className="text-body text-text-secondary">Loading…</p>}
      {!loading && !profile && (
        <p className="text-body text-danger">Couldn’t load your profile.</p>
      )}
      {profile && <Body profile={profile} save={save} />}
    </SettingsLayout>
  )
}

function Body({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  const openSheet = useSheetNavigate()
  const [cacheCount, setCacheCount] = useState(() => bookMatchCacheSize())

  return (
    <>
      <SectionCard title="Entry Form">
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
        <FieldRow label="Enable Bulk Books Import">
          <Toggle
            checked={profile.book_importer_enabled}
            onChange={(on) => void save({ book_importer_enabled: on })}
            label="Enable Bulk Books Import"
          />
        </FieldRow>
        {profile.book_importer_enabled ? (
          <>
            <button
              onClick={() => openSheet(routes.books.import)}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-accent active:bg-input/40"
            >
              <IconUpload size={18} /> Import CSV Books
            </button>
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
