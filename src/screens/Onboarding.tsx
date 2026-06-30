import { useRef, useState } from 'react'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { PrimaryButton } from '../components/PrimaryButton'
import { RingMark } from '../components/RingMark'
import {
  ProfileMetricsFields,
  type ProfileMetrics,
} from '../components/ProfileMetricsFields'
import { supabase } from '../lib/supabase'

/**
 * Forced first-run wizard (M-multi). Shown by `AppShell`'s OnboardingGate to a brand-new member
 * whose profile has no `onboarded_at`. Collects their own body metrics — which they must never
 * inherit from the owner — then stamps `onboarded_at`, which dismisses the gate (the profile
 * refetch flips `needsOnboarding` to false). There is no nav chrome: it's a gate, so the only way
 * out other than finishing is the global sign-out.
 */
export function Onboarding() {
  const { save } = useProfileEditor()

  const [value, setValue] = useState<ProfileMetrics>({
    birthday: null,
    sex: 'female',
    units: 'metric',
    height_cm: null,
    weight_kg: null,
  })
  // Mirror the latest value so submit reads fresh data even when a height/weight blur commits in the
  // same tap as the button click (blur fires before the click, but its setState hasn't re-rendered).
  const valueRef = useRef(value)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)

  function update(patch: Partial<ProfileMetrics>) {
    valueRef.current = { ...valueRef.current, ...patch }
    setValue(valueRef.current)
    setAttempted(false)
  }

  const isComplete = (v: ProfileMetrics) =>
    !!v.birthday && v.height_cm != null && v.weight_kg != null

  async function submit() {
    const v = valueRef.current
    if (!isComplete(v)) {
      setAttempted(true)
      return
    }
    if (saving) return
    setSaving(true)
    try {
      await save({
        birthday: v.birthday,
        sex: v.sex,
        units: v.units,
        height_cm: v.height_cm,
        weight_kg: v.weight_kg,
        onboarded_at: new Date().toISOString(),
      })
      // On success the gate unmounts this screen (profile refetch), so no further state work.
    } catch {
      setSaving(false) // keep the wizard up so the member can retry
    }
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col overflow-y-auto bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex flex-col gap-5 px-4 py-8">
        <header className="flex flex-col items-center gap-3 text-center">
          {/* Same brand mark as the Login screen (RingMark, inline SVG via currentColor) so the
              two on-screen logos share one source and can't drift. The installed-app/home-screen
              icon is necessarily a separate raster (public/*.png, see scripts/gen-icons.mjs). */}
          <RingMark className="size-16 text-accent" />
          <div>
            <h1 className="text-title font-medium text-text-primary">
              Welcome to WellWorth
            </h1>
            <p className="mt-1 text-body text-text-secondary">
              Tell us a little about you so your targets are accurate.
            </p>
          </div>
        </header>

        <ProfileMetricsFields value={value} onChange={update} />

        {attempted && (
          <p className="text-center text-body text-danger">
            Please fill in your birthday, height and weight to continue.
          </p>
        )}

        <PrimaryButton onClick={submit} disabled={saving} className="w-full">
          {saving ? 'Saving…' : 'Get started'}
        </PrimaryButton>

        <button
          onClick={() => void supabase.auth.signOut()}
          className="mx-auto text-caption text-text-tertiary"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
