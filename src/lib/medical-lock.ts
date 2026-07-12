/**
 * Medical biometric-lock primitives (M6). The lock is a **client-side UX gate over already-
 * RLS-protected data** — not a server-verified boundary (there is no relying-party backend). This
 * module holds the dependable, testable parts: the salted PIN hash (PBKDF2-SHA-256, never plaintext),
 * the auto-lock timeout choices + idle check, and the lock's session/persistent flags. WebAuthn
 * (the optional faster unlock) lives in `medical-webauthn.ts`; the lifecycle lives in
 * `MedicalLockProvider`.
 */

// ── PIN hashing (Web Crypto; works in the browser and Node's webcrypto for tests) ──────────────

const PBKDF2_ITERATIONS = 100_000

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveBits(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return new Uint8Array(bits)
}

/** Hash a PIN with a fresh random salt → `pbkdf2$<iters>$<saltB64>$<hashB64>` (stored, never the PIN). */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await deriveBits(pin, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(bits)}`
}

/** Constant-time-ish verify of a PIN against a stored `hashPin` string. Malformed input → false. */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const salt = fromBase64(parts[2]!)
  const expected = fromBase64(parts[3]!)
  const actual = await deriveBits(pin, salt, iterations)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!
  return diff === 0
}

/** A PIN must be 4–8 digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin)
}

// ── Auto-lock timeout ──────────────────────────────────────────────────────────────────────────

export function timeoutToValue(minutes: number | null | undefined): string {
  return minutes == null ? 'indefinite' : String(minutes)
}

export function valueToTimeoutMinutes(value: string): number | null {
  return value === 'indefinite' ? null : Number(value)
}

/**
 * Has the lock idled out? Pure. `timeoutMinutes === null` (Indefinite) never idle-expires (cold-start
 * only). The provider handles the `0` ("Immediately") case via background/leave, not this idle check.
 */
export function isIdleExpired(
  lastActiveMs: number,
  nowMs: number,
  timeoutMinutes: number | null,
): boolean {
  if (timeoutMinutes == null) return false
  return nowMs - lastActiveMs >= timeoutMinutes * 60_000
}

// ── Lock flags (session = survives in-app nav, clears on cold start; localStorage hint = no flash) ──

const SS_UNLOCKED = 'med_lock_unlocked'
const SS_ACTIVE = 'med_lock_active'
const LS_ENABLED_HINT = 'med_lock_on'

export function rememberUnlocked(): void {
  try {
    sessionStorage.setItem(SS_UNLOCKED, '1')
  } catch {
    /* storage unavailable — lock just re-prompts, which is the safe direction */
  }
}

export function forgetUnlocked(): void {
  try {
    sessionStorage.removeItem(SS_UNLOCKED)
  } catch {
    /* ignore */
  }
}

export function isUnlockedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SS_UNLOCKED) === '1'
  } catch {
    return false
  }
}

export function setLastActive(ms: number): void {
  try {
    sessionStorage.setItem(SS_ACTIVE, String(ms))
  } catch {
    /* ignore */
  }
}

export function getLastActive(): number {
  try {
    const v = sessionStorage.getItem(SS_ACTIVE)
    return v ? Number(v) : 0
  } catch {
    return 0
  }
}

/** A persistent hint that the lock is configured, read synchronously so a cold start doesn't flash
 * Medical content before the profile loads. */
export function setEnabledHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(LS_ENABLED_HINT, '1')
    else localStorage.removeItem(LS_ENABLED_HINT)
  } catch {
    /* ignore */
  }
}

export function enabledHint(): boolean {
  try {
    return localStorage.getItem(LS_ENABLED_HINT) === '1'
  } catch {
    return false
  }
}
