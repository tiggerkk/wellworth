import { useRef, useState } from 'react'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { PrimaryButton } from '../components/PrimaryButton'
import { BrandMark } from '../components/BrandMark'
import { DisplaySettingsCard } from '../components/DisplaySettingsCard'
import {
  ProfileMetricsFields,
  type ProfileMetrics,
} from '../components/ProfileMetricsFields'
import { type FontSize } from '../lib/font-scale'
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
  // Font size is a Display preference, not a body metric, so it lives outside `ProfileMetrics`.
  // `DisplaySettingsCard` applies the preset instantly; we persist it with the rest on submit.
  const [fontSize, setFontSize] = useState<FontSize>('default')
  // Replica of the latest value so submit reads fresh data even when a height/weight blur commits in the
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
        font_size: fontSize,
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
    // z-20 (not the usual top-layer z-50): the gate must sit *below* the z-30 route-sheet layer so
    // the DISPLAY → Visible Modules sheet (and the birthday Calendar) paint above it. It still covers
    // the app behind it (content + bottom nav are z-10); the Toaster (z-50) stays on top.
    <div className="fixed inset-0 z-20 mx-auto flex max-w-md flex-col overflow-y-auto bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex flex-col gap-5 px-4 py-8">
        <header className="flex flex-col items-center gap-3 text-center">
          {/* Same brand mark as the Login screen (BrandMark, inline SVG via currentColor) so the
              two on-screen logos share one source and can't drift. The installed-app/home-screen
              icon is necessarily a separate raster (public/*.png, see scripts/gen-icons.mjs). */}
          <BrandMark className="size-16 text-accent" />
          <div>
            <h1 className="text-title font-medium text-text-primary">
              Welcome to WellWorth
            </h1>
            <p className="mt-1 text-body text-text-secondary">
              Tell us a little about you so your targets are accurate.
            </p>
          </div>
        </header>

        <DisplaySettingsCard
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          units={value.units}
          onUnitsChange={(units) => update({ units })}
        />

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
