import { useState } from 'react'
import { IconChevronRight, IconTrash, IconUpload } from '@tabler/icons-react'
import { SettingsLoader } from '../components/SettingsLoader'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { clearFoodMatchCache, foodMatchCacheSize } from '../lib/wellness-food-match-cache'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Wellness-specific sub-settings (protein target + nutrient display). Reached from the
 * Settings tab in the Wellness bottom nav. App-wide settings (profile, units, account) live
 * in the global Settings screen at the Home level.
 */
export function WellnessSettings() {
  const { profile, loading, error, save } = useProfileEditor()

  return (
    <SettingsLoader
      title="Wellness Settings"
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
  const [proteinDraft, setProteinDraft] = useState(
    profile.protein_target_g == null ? '' : String(profile.protein_target_g),
  )
  const [cacheCount, setCacheCount] = useState(() => foodMatchCacheSize())

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
        <FieldRow label="Enable Bulk Food Import">
          <Toggle
            checked={profile.food_importer_enabled}
            onChange={(on) => void save({ food_importer_enabled: on })}
            label="Enable Bulk Food Import"
          />
        </FieldRow>
        {profile.food_importer_enabled ? (
          <>
            <button
              onClick={() => openSheet(routes.wellness.importFoods)}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-body text-accent active:bg-input/40"
            >
              <IconUpload size={18} /> Import CSV Food
            </button>
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
