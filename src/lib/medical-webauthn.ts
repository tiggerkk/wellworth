/**
 * Medical lock — the **optional** WebAuthn platform-authenticator unlock (Face ID / Touch ID on iOS
 * 16+, Windows Hello, etc.). This is a layered convenience on top of the mandatory PIN: there is **no
 * relying-party backend**, so `navigator.credentials.get()` is used only as a **local
 * presence/user-verification check** — the assertion is never sent anywhere or cryptographically
 * verified. Any failure (unsupported, cancelled, iOS standalone-PWA storage partitioning) is swallowed
 * so the caller silently falls back to the PIN — biometric can never cause a lockout.
 *
 * Everything here is browser-only and guarded; it is not unit-tested (jsdom has no authenticator).
 */

function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** True only when a user-verifying platform authenticator is actually available (feature-detected). */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Register a platform authenticator and return its credential id (base64url) to store in
 * `medical_lock_webauthn_id`. The user handle + challenge are random local values (no server). Returns
 * null if registration is unavailable, cancelled, or fails.
 */
export async function registerPlatformCredential(
  userName: string,
): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return null
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'WellWorth', id: window.location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null
    if (!cred) return null
    return toBase64Url(new Uint8Array(cred.rawId))
  } catch {
    return null
  }
}

/**
 * Prompt the platform authenticator for the stored credential as a **local** user-verification check.
 * Returns true if the user verified (resolves), false on any failure/cancellation — the caller then
 * falls back to the PIN. The assertion is NOT server-verified (no relying party).
 */
export async function assertPlatformCredential(credentialId: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return false
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return assertion != null
  } catch {
    return false
  }
}
