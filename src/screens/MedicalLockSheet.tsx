import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { SelectMenu } from '../components/SelectMenu'
import { PrimaryButton } from '../components/PrimaryButton'
import { PinInput } from '../components/PinInput'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useAuth } from '../auth/AuthProvider'
import {
  DEFAULT_LOCK_TIMEOUT_MINUTES,
  forgetUnlocked,
  hashPin,
  isValidPin,
  LOCK_TIMEOUT_OPTIONS,
  rememberUnlocked,
  setEnabledHint,
  timeoutToValue,
  valueToTimeoutMinutes,
  verifyPin,
} from '../lib/medical-lock'
import {
  isPlatformAuthenticatorAvailable,
  registerPlatformCredential,
} from '../lib/medical-webauthn'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Medical → Security → Lock (M6): set up / change / turn off the PIN, register the optional biometric
 * unlock, and pick the auto-lock timeout. The PIN is mandatory and stored only as a salted hash; the
 * biometric toggle is hidden where no platform authenticator is available. Mirrors the other Medical
 * settings sheets; the actual gate lives in `MedicalLockProvider` / `MedicalLockScreen`.
 */
export function MedicalLockSheet() {
  const navigate = useNavigate()
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Lock">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-heading font-medium text-text-primary">Lock</h1>
      </header>
      {loading && <p className="p-4 text-body text-text-secondary">Loading…</p>}
      {profile && <Body profile={profile} save={save} />}
    </Sheet>
  )
}

function Body({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  const { session } = useAuth()
  const email = session?.user.email ?? 'WellWorth'
  const enabled = profile.medical_lock_enabled && !!profile.medical_lock_pin_hash
  const pinHash = profile.medical_lock_pin_hash

  const [bioAvailable, setBioAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Setup / change fields
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [current, setCurrent] = useState('')
  const [mode, setMode] = useState<'none' | 'change' | 'disable'>('none')

  useEffect(() => {
    let cancelled = false
    void isPlatformAuthenticatorAvailable().then((ok) => {
      if (!cancelled) setBioAvailable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function resetFields() {
    setPin('')
    setConfirm('')
    setCurrent('')
    setError(null)
  }

  async function enableLock() {
    if (busy) return
    if (!isValidPin(pin)) return setError('PIN must be 4–8 digits.')
    if (pin !== confirm) return setError('PINs don’t match.')
    setBusy(true)
    const hash = await hashPin(pin)
    await save({
      medical_lock_enabled: true,
      medical_lock_pin_hash: hash,
      medical_lock_timeout_minutes: DEFAULT_LOCK_TIMEOUT_MINUTES,
    })
    setEnabledHint(true)
    rememberUnlocked() // don't lock the owner out immediately after setting it up
    setBusy(false)
    resetFields()
  }

  async function changePin() {
    if (busy || !pinHash) return
    if (!(await verifyPin(current, pinHash))) return setError('Current PIN is incorrect.')
    if (!isValidPin(pin)) return setError('New PIN must be 4–8 digits.')
    if (pin !== confirm) return setError('PINs don’t match.')
    setBusy(true)
    const hash = await hashPin(pin)
    await save({ medical_lock_pin_hash: hash })
    rememberUnlocked()
    setBusy(false)
    setMode('none')
    resetFields()
  }

  async function disableLock() {
    if (busy || !pinHash) return
    if (!(await verifyPin(current, pinHash))) return setError('PIN is incorrect.')
    setBusy(true)
    await save({
      medical_lock_enabled: false,
      medical_lock_pin_hash: null,
      medical_lock_webauthn_id: null,
    })
    setEnabledHint(false)
    forgetUnlocked()
    setBusy(false)
    setMode('none')
    resetFields()
  }

  async function toggleBiometric(on: boolean) {
    setError(null)
    if (on) {
      const id = await registerPlatformCredential(email)
      if (id) await save({ medical_lock_webauthn_id: id })
      else setError('Couldn’t set up biometric unlock. The PIN still works.')
    } else {
      await save({ medical_lock_webauthn_id: null })
    }
  }

  if (!enabled) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-body text-text-secondary">
          Lock the Medical module behind a PIN (and optional Face ID / Touch ID). It
          guards this device — your data is already private to your account.
        </p>
        <SectionCard title="Set a PIN">
          <div className="flex flex-col gap-3 p-4">
            <PinInput value={pin} onChange={setPin} placeholder="New PIN (4–8 digits)" />
            <PinInput
              value={confirm}
              onChange={setConfirm}
              onSubmit={() => void enableLock()}
              placeholder="Confirm PIN"
            />
            {error && <p className="text-body text-danger">{error}</p>}
            <PrimaryButton onClick={() => void enableLock()} disabled={busy}>
              Enable Lock
            </PrimaryButton>
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-4">
      {/* Plain (non-overflow-hidden) card so the SelectMenu dropdown isn't clipped — a SectionCard's
          `overflow-hidden` would cut off all but the first option or two. */}
      <div>
        <h2 className="mb-2 px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
          Auto-lock
        </h2>
        <div className="rounded-card border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-body text-text-primary">Lock after</span>
            <SelectMenu
              value={timeoutToValue(profile.medical_lock_timeout_minutes)}
              options={LOCK_TIMEOUT_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              onChange={(v) =>
                void save({ medical_lock_timeout_minutes: valueToTimeoutMinutes(v) })
              }
              ariaLabel="Auto-lock timeout"
              className="w-44"
            />
          </div>
          <div className="px-4 pb-3 text-caption text-text-tertiary">
            Always re-locks when the app is restarted.
          </div>
        </div>
      </div>

      {bioAvailable && (
        <SectionCard title="Biometric">
          <FieldRow label="Unlock with Face ID / Touch ID">
            <Toggle
              checked={!!profile.medical_lock_webauthn_id}
              onChange={(on) => void toggleBiometric(on)}
              label="Biometric unlock"
            />
          </FieldRow>
        </SectionCard>
      )}

      <SectionCard title="PIN">
        {mode !== 'change' ? (
          <button
            onClick={() => {
              resetFields()
              setMode('change')
            }}
            className="w-full px-4 py-3 text-left text-body text-accent active:bg-input/40"
          >
            Change PIN
          </button>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <PinInput value={current} onChange={setCurrent} placeholder="Current PIN" />
            <PinInput value={pin} onChange={setPin} placeholder="New PIN (4–8 digits)" />
            <PinInput
              value={confirm}
              onChange={setConfirm}
              onSubmit={() => void changePin()}
              placeholder="Confirm new PIN"
            />
            {error && <p className="text-body text-danger">{error}</p>}
            <div className="flex gap-2">
              <PrimaryButton onClick={() => void changePin()} disabled={busy}>
                Save PIN
              </PrimaryButton>
              <button
                onClick={() => {
                  setMode('none')
                  resetFields()
                }}
                className="px-3 py-1.5 text-body text-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Turn off">
        {mode !== 'disable' ? (
          <button
            onClick={() => {
              resetFields()
              setMode('disable')
            }}
            className="w-full px-4 py-3 text-left text-body text-danger active:bg-input/40"
          >
            Turn off lock
          </button>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-body text-text-secondary">
              Enter your PIN to turn off the lock.
            </p>
            <PinInput
              value={current}
              onChange={setCurrent}
              onSubmit={() => void disableLock()}
              placeholder="Current PIN"
            />
            {error && <p className="text-body text-danger">{error}</p>}
            <div className="flex gap-2">
              <PrimaryButton onClick={() => void disableLock()} disabled={busy}>
                Turn off lock
              </PrimaryButton>
              <button
                onClick={() => {
                  setMode('none')
                  resetFields()
                }}
                className="px-3 py-1.5 text-body text-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
