import { useEffect, useState } from 'react'
import { IconFaceId, IconLock } from '@tabler/icons-react'
import { useMedicalLock } from './MedicalLockProvider'
import { PinInput } from './PinInput'
import { PrimaryButton } from './PrimaryButton'
import { useProfile } from '../hooks/useProfile'
import { verifyPin } from '../lib/medical-lock'
import {
  assertPlatformCredential,
  isPlatformAuthenticatorAvailable,
} from '../lib/medical-webauthn'
import { supabase } from '../lib/supabase'

/**
 * The Medical lock gate (M6). Shown by `AppShell` whenever the Medical module is locked. The
 * **mandatory PIN** is always available; if a platform authenticator was registered it is auto-tried
 * on mount (and re-tryable) as a faster unlock that silently falls back to the PIN on any failure.
 * Covers the whole shell. A "Sign out" escape avoids a hard lockout if the PIN is forgotten.
 */
export function MedicalLockScreen() {
  const { unlock } = useMedicalLock()
  const { data: profile } = useProfile()
  const pinHash = profile?.medical_lock_pin_hash ?? null
  const credentialId = profile?.medical_lock_webauthn_id ?? null

  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)

  // Feature-detect + auto-attempt the platform authenticator once when the gate appears.
  useEffect(() => {
    if (!credentialId) return
    let cancelled = false
    void (async () => {
      const available = await isPlatformAuthenticatorAvailable()
      if (cancelled) return
      setBioAvailable(available)
      if (available) {
        const ok = await assertPlatformCredential(credentialId)
        if (!cancelled && ok) unlock()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [credentialId, unlock])

  async function tryBiometric() {
    if (!credentialId) return
    const ok = await assertPlatformCredential(credentialId)
    if (ok) unlock()
  }

  async function submitPin() {
    if (!pinHash || checking) return
    setChecking(true)
    const ok = await verifyPin(pin, pinHash)
    setChecking(false)
    if (ok) {
      unlock()
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col items-center justify-center gap-5 bg-bg px-8 pt-[env(safe-area-inset-top)]">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface">
        <IconLock size={26} className="text-text-secondary" />
      </div>
      <div className="text-center">
        <h1 className="text-lg font-medium text-text-primary">Medical is locked</h1>
        <p className="mt-1 text-sm text-text-secondary">Enter your PIN to continue.</p>
      </div>

      <div className="w-full max-w-xs">
        <PinInput
          value={pin}
          onChange={(v) => {
            setPin(v)
            setError(false)
          }}
          onSubmit={submitPin}
          placeholder="PIN"
          autoFocus
          ariaLabel="Unlock PIN"
        />
        {error && <p className="mt-2 text-center text-sm text-danger">Incorrect PIN.</p>}
        <PrimaryButton
          onClick={submitPin}
          disabled={pin.length < 4 || checking}
          className="mt-3 w-full"
        >
          {checking ? 'Checking…' : 'Unlock'}
        </PrimaryButton>
      </div>

      {bioAvailable && credentialId && (
        <button
          onClick={tryBiometric}
          className="flex items-center gap-2 text-sm font-medium text-accent"
        >
          <IconFaceId size={18} /> Use Face ID / Touch ID
        </button>
      )}

      <button
        onClick={() => void supabase.auth.signOut()}
        className="mt-2 text-xs text-text-tertiary"
      >
        Forgot PIN? Sign out
      </button>
    </div>
  )
}
