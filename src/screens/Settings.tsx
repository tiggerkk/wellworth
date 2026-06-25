import { useState } from 'react'
import { useNavigate } from 'react-router'
import { IconChevronLeft } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import {
  ProfileMetricsFields,
  type ProfileMetrics,
} from '../components/ProfileMetricsFields'
import type { Tables, TablesUpdate } from '../types/database'

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
        <p className="text-sm text-danger">
          Couldn’t load your profile. If you just reset the database, sign out below and
          sign back in to recreate it.
        </p>
      )}
      {profile && <SettingsBody profile={profile} save={save} />}
      {/* Account/sign-out is driven by the session, not the profile, so it stays usable
          even when the profile fails to load (e.g. after a DB reset deletes the user). */}
      {!loading && <AccountCard />}
    </div>
  )
}

function AccountCard() {
  const { session } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      // `scope: 'local'` only needs to clear the browser session — it doesn't depend on the
      // server accepting the request, which it won't for a user deleted by a DB reset.
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Ignore — the hard clear below guarantees the stale session is gone.
    } finally {
      // Bulletproof fallback: drop any persisted Supabase auth token and reload, so a stale
      // session for a now-deleted user is always cleared and the app returns to the login screen.
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key)
          }
        }
      } catch {
        // localStorage unavailable — the signOut above already handled the common case.
      }
      window.location.reload()
    }
  }

  return (
    <SectionCard title="Account">
      <FieldRow label="Google Account">{session?.user.email ?? '—'}</FieldRow>
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
  )
}

function SettingsBody({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  // Local mirror of the canonical metrics; each field change persists immediately (auto-save).
  const [value, setValue] = useState<ProfileMetrics>({
    birthday: profile.birthday,
    sex: profile.sex === 'male' ? 'male' : 'female',
    units: profile.units,
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
  })

  function update(patch: Partial<ProfileMetrics>) {
    setValue((v) => ({ ...v, ...patch }))
    void save(patch)
  }

  return <ProfileMetricsFields value={value} onChange={update} />
}
