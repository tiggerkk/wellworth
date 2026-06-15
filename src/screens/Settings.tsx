import { useState } from 'react'
import { useNavigate } from 'react-router'
import { IconChevronLeft } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { cmToInches, inchesToCm, kgToPounds, poundsToKg } from '../lib/units'
import type { Tables, TablesUpdate } from '../types/database'

const round1 = (n: number) => Math.round(n * 10) / 10

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Global (app-wide) settings, reached from the Home hub: profile, units, account.
 * These apply across all modules. Wellness-specific settings (protein target,
 * nutrient display) live in the Wellness module's own `WellnessSettings` screen.
 */
export function Settings() {
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
        <h1 className="text-lg font-medium text-text-primary">Settings</h1>
      </header>
      {loading && <p className="text-sm text-text-secondary">Loading…</p>}
      {!loading && !profile && (
        <p className="text-sm text-danger">Couldn’t load your profile.</p>
      )}
      {profile && <SettingsBody profile={profile} save={save} />}
    </div>
  )
}

function SettingsBody({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  const { session } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const [units, setUnits] = useState(profile.units)
  const [birthday, setBirthday] = useState(profile.birthday ?? '')
  const [sex, setSex] = useState(profile.sex ?? 'female')

  const imperial = units === 'imperial'
  const fmtHeight = (cm: number | null) =>
    cm == null ? '' : String(round1(imperial ? cmToInches(cm) : cm))
  const fmtWeight = (kg: number | null) =>
    kg == null ? '' : String(round1(imperial ? kgToPounds(kg) : kg))

  const [heightDraft, setHeightDraft] = useState(fmtHeight(profile.height_cm))
  const [weightDraft, setWeightDraft] = useState(fmtWeight(profile.weight_kg))

  function commitUnits(next: string) {
    setUnits(next)
    const nextImperial = next === 'imperial'
    setHeightDraft(
      profile.height_cm == null
        ? ''
        : String(
            round1(nextImperial ? cmToInches(profile.height_cm) : profile.height_cm),
          ),
    )
    setWeightDraft(
      profile.weight_kg == null
        ? ''
        : String(
            round1(nextImperial ? kgToPounds(profile.weight_kg) : profile.weight_kg),
          ),
    )
    void save({ units: next })
  }

  function commitHeight() {
    const n = Number(heightDraft)
    const cm =
      heightDraft.trim() === '' || !Number.isFinite(n)
        ? null
        : imperial
          ? inchesToCm(n)
          : n
    void save({ height_cm: cm })
  }
  function commitWeight() {
    const n = Number(weightDraft)
    const kg =
      weightDraft.trim() === '' || !Number.isFinite(n)
        ? null
        : imperial
          ? poundsToKg(n)
          : n
    void save({ weight_kg: kg })
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  const inputCls =
    'w-24 rounded-input bg-input px-2 py-1 text-right text-[15px] text-text-primary focus:outline-none'

  return (
    <>
      <SectionCard title="Profile">
        <FieldRow label="Birthday">
          <input
            type="date"
            value={birthday}
            onChange={(e) => {
              setBirthday(e.target.value)
              void save({ birthday: e.target.value || null })
            }}
            className="rounded-input bg-input px-2 py-1 text-[15px] text-text-primary focus:outline-none"
          />
        </FieldRow>
        <FieldRow label="Sex">
          <div className="w-40">
            <SegmentedTabs
              value={sex}
              onChange={(v) => {
                setSex(v)
                void save({ sex: v })
              }}
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
              ]}
            />
          </div>
        </FieldRow>
        <FieldRow label={`Height (${imperial ? 'in' : 'cm'})`}>
          <input
            type="number"
            step="any"
            value={heightDraft}
            onChange={(e) => setHeightDraft(e.target.value)}
            onBlur={commitHeight}
            className={inputCls}
          />
        </FieldRow>
        <FieldRow label={`Weight (${imperial ? 'lb' : 'kg'})`}>
          <input
            type="number"
            step="any"
            value={weightDraft}
            onChange={(e) => setWeightDraft(e.target.value)}
            onBlur={commitWeight}
            className={inputCls}
          />
        </FieldRow>
      </SectionCard>

      <SectionCard title="Account">
        <FieldRow label="Units">
          <div className="w-40">
            <SegmentedTabs
              value={units}
              onChange={commitUnits}
              options={[
                { value: 'metric', label: 'Metric' },
                { value: 'imperial', label: 'Imperial' },
              ]}
            />
          </div>
        </FieldRow>
        <FieldRow label="Google account">{session?.user.email ?? '—'}</FieldRow>
        <div className="px-4 py-3">
          <button
            onClick={signOut}
            disabled={signingOut}
            className="text-sm text-accent disabled:opacity-50"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </SectionCard>
    </>
  )
}
