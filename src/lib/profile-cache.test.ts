import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCachedProfile, getCachedProfile, setCachedProfile } from './profile-cache'
import type { Tables } from '../types/database'

// The test runs in the `node` environment (no jsdom), so stub a minimal in-memory localStorage.
function installStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  return store
}

// A profile only needs the fields under test; cast the partial to the row type.
function profile(over: Partial<Tables<'profile'>> = {}): Tables<'profile'> {
  return {
    module_order: ['networth', 'wellness'],
    visible_modules: ['networth'],
    medical_lock_enabled: true,
    medical_lock_pin_hash: 'pbkdf2$100000$salt$hash',
    medical_lock_webauthn_id: 'cred-abc',
    ...over,
  } as Tables<'profile'>
}

beforeEach(() => {
  installStorage()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('profile cache', () => {
  it('round-trips the order/visibility fields per user', () => {
    setCachedProfile('user-1', profile())
    const got = getCachedProfile('user-1')
    expect(got?.module_order).toEqual(['networth', 'wellness'])
    expect(got?.visible_modules).toEqual(['networth'])
  })

  it('strips the Medical lock credentials before writing', () => {
    setCachedProfile('user-1', profile())
    const got = getCachedProfile('user-1')
    // The non-secret enabled flag is kept; the PIN hash and webauthn id are nulled out.
    expect(got?.medical_lock_enabled).toBe(true)
    expect(got?.medical_lock_pin_hash).toBeNull()
    expect(got?.medical_lock_webauthn_id).toBeNull()
    // And the raw stored JSON never contains the secret at all.
    expect(localStorage.getItem('wellworth:profile:user-1')).not.toContain(
      'pbkdf2$100000$salt$hash',
    )
  })

  it('isolates cache by user id', () => {
    setCachedProfile('user-1', profile({ module_order: ['wellness'] }))
    setCachedProfile('user-2', profile({ module_order: ['books'] }))
    expect(getCachedProfile('user-1')?.module_order).toEqual(['wellness'])
    expect(getCachedProfile('user-2')?.module_order).toEqual(['books'])
  })

  it('returns undefined when nothing is cached', () => {
    expect(getCachedProfile('nobody')).toBeUndefined()
  })

  it('clears and treats null as a clear', () => {
    setCachedProfile('user-1', profile())
    clearCachedProfile('user-1')
    expect(getCachedProfile('user-1')).toBeUndefined()

    setCachedProfile('user-2', profile())
    setCachedProfile('user-2', null)
    expect(getCachedProfile('user-2')).toBeUndefined()
  })

  it('degrades gracefully when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => setCachedProfile('user-1', profile())).not.toThrow()
    expect(getCachedProfile('user-1')).toBeUndefined()
  })

  it('returns undefined for corrupt JSON', () => {
    localStorage.setItem('wellworth:profile:user-1', '{not json')
    expect(getCachedProfile('user-1')).toBeUndefined()
  })
})
