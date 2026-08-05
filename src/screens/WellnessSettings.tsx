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
import { clearFoodMatchCache, foodMatchCacheSize } from '../lib/wellness-food-match-cache'
import { listFoods } from '../data/food'
import { listServingsForFoods } from '../data/serving'
import { getAllNutrients } from '../data/nutrient'
import { listAllEntriesForExport } from '../data/diary-entry'
import { listSetsForEntries } from '../data/strength-set'
import { buildFoodExportRows } from '../lib/wellness-food-export'
import { buildDiaryExportData } from '../lib/wellness-diary-export'
import { downloadCsv, downloadJson } from '../lib/file-export'
import { errorMessage } from '../lib/errors'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Wellness-specific settings (protein target + nutrient display).
 */
export function WellnessSettings() {
  const { profile, loading, error, save } = useProfileEditor()
  const { session } = useAuth()
  const userId = session?.user.id

  return (
    <SettingsLoader
      title="Wellness Settings"
      loading={loading}
      error={error}
      data={profile}
      errorText="Couldn’t load your profile."
    >
      {(profile) => <Body profile={profile} save={save} userId={userId} />}
    </SettingsLoader>
  )
}

function Body({
  profile,
  save,
  userId,
}: {
  profile: Tables<'profile'>
  save: SaveFn
  userId: string | undefined
}) {
  const openSheet = useSheetNavigate()
  const [proteinDraft, setProteinDraft] = useState(
    profile.protein_target_g == null ? '' : String(profile.protein_target_g),
  )
  const [cacheCount, setCacheCount] = useState(() => foodMatchCacheSize())
  const [exportingFoods, setExportingFoods] = useState(false)
  const [exportingDiary, setExportingDiary] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function exportFoods() {
    setExportingFoods(true)
    setExportError(null)
    try {
      const [foods, nutrients] = await Promise.all([listFoods(), getAllNutrients()])
      const servingsByFoodId = await listServingsForFoods(foods.map((f) => f.id))
      const rows = buildFoodExportRows(
        foods,
        servingsByFoodId,
        nutrients.map((n) => n.key),
      )
      const today = new Date().toISOString().slice(0, 10)
      downloadCsv(`wellness-food-export-${today}.csv`, rows)
    } catch (e) {
      setExportError(errorMessage(e, 'Export failed.'))
    } finally {
      setExportingFoods(false)
    }
  }

  async function exportDiary() {
    if (!userId) return
    setExportingDiary(true)
    setExportError(null)
    try {
      const entries = await listAllEntriesForExport(userId)
      const strengthSets = await listSetsForEntries(entries.map((e) => e.id))
      const data = buildDiaryExportData(entries, strengthSets)
      const today = new Date().toISOString().slice(0, 10)
      downloadJson(`wellness-diary-export-${today}.json`, data)
    } catch (e) {
      setExportError(errorMessage(e, 'Export failed.'))
    } finally {
      setExportingDiary(false)
    }
  }

  function commitProtein() {
    const n = Number(proteinDraft)
    void save({
      protein_target_g: proteinDraft.trim() === '' || !Number.isFinite(n) ? null : n,
    })
  }

  const inputCls = 'field-control no-spinner w-24 text-right'

  return (
    <>
      <SectionCard title="Display">
        <button
          onClick={() => openSheet(routes.wellness.settingsHighlighted)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Highlighted Nutrients">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
        <button
          onClick={() => openSheet(routes.wellness.settingsVisible)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="Visible Nutrients">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="Targets">
        <FieldRow label="Protein Target (g)">
          <input
            type="number"
            step="any"
            placeholder="DRI"
            value={proteinDraft}
            onChange={(e) => setProteinDraft(e.target.value)}
            onBlur={commitProtein}
            className={inputCls}
          />
        </FieldRow>
        <div className="px-4 py-2 text-caption text-text-tertiary">
          Other targets are set automatically from your profile (DRI).
        </div>
      </SectionCard>

      <SectionCard title="Import">
        <FieldRow label="Enable Bulk Import / Export">
          <Toggle
            checked={profile.food_importer_enabled}
            onChange={(on) => void save({ food_importer_enabled: on })}
            label="Enable Bulk Import / Export"
          />
        </FieldRow>
        {profile.food_importer_enabled ? (
          <>
            <ImportExportRow
              importLabel="Import CSV Food"
              onImport={() => openSheet(routes.wellness.importFoods)}
              exportLabel="Export CSV Food"
              onExport={() => void exportFoods()}
              exporting={exportingFoods}
            />
            <button
              onClick={() => {
                clearFoodMatchCache()
                setCacheCount(0)
              }}
              disabled={cacheCount === 0}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-text-secondary last:border-b-0 active:bg-input/40 disabled:opacity-40"
            >
              <IconTrash size={18} />
              Clear Import Match Cache{cacheCount ? ` (${cacheCount})` : ''}
            </button>
            <p className="px-4 py-2 text-caption text-text-tertiary">
              Bulk-seed your foods from a CSV — each row is matched against USDA (custom
              foods for the rest), all saved as favorites. The importer remembers each
              USDA match in this browser so re-importing the same CSV is instant; clearing
              it forces a fresh lookup. It’s not affected by a database reset.
            </p>
            <ImportExportRow
              importLabel="Import JSON Diary"
              onImport={() => openSheet(routes.wellness.importDiary)}
              exportLabel="Export JSON Diary"
              onExport={() => void exportDiary()}
              exporting={exportingDiary}
              exportDisabled={!userId}
            />
            <p className="px-4 py-2 text-caption text-text-tertiary">
              Bulk-replace your Diary from a JSON file — each day in the file fully
              replaces that day's existing entries, so re-importing the same file is safe
              to repeat. Foods/activities are linked back to your library by name on a
              best-effort basis; unmatched rows still import, just unlinked.
            </p>
            {exportError && (
              <p className="px-4 py-2 text-caption text-danger">{exportError}</p>
            )}
          </>
        ) : (
          <div className="px-4 py-2 text-caption text-text-tertiary">
            Turn this on to bulk-seed your foods from a CSV.
          </div>
        )}
      </SectionCard>
    </>
  )
}
