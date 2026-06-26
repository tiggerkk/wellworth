import { useState } from 'react'
import { useNavigate } from 'react-router'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Wellness-specific sub-settings (protein target + nutrient display). Reached from the
 * Settings tab in the Wellness bottom nav. App-wide settings (profile, units, account) live
 * in the global Settings screen at the Home level.
 */
export function WellnessSettings() {
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
        <h1 className="text-lg font-medium text-text-primary">Wellness Settings</h1>
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
  const [proteinDraft, setProteinDraft] = useState(
    profile.protein_target_g == null ? '' : String(profile.protein_target_g),
  )

  function commitProtein() {
    const n = Number(proteinDraft)
    void save({
      protein_target_g: proteinDraft.trim() === '' || !Number.isFinite(n) ? null : n,
    })
  }

  const inputCls =
    'w-24 rounded-input bg-input px-2 py-1 text-right text-[15px] text-text-primary focus:outline-none'

  return (
    <>
      <SectionCard title="Display">
        <button
          onClick={() => openSheet(routes.wellness.settingsHighlighted)}
          className="w-full"
        >
          <FieldRow label="Highlighted Nutrients">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
        <button
          onClick={() => openSheet(routes.wellness.settingsVisible)}
          className="w-full"
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
        <div className="px-4 py-2 text-xs text-text-tertiary">
          Other targets are set automatically from your profile (DRI).
        </div>
      </SectionCard>
    </>
  )
}
