import { describe, expect, it } from 'vitest'
import {
  isEmailAllowed,
  isOwnerEmail,
  needsOnboarding,
  parseAllowlist,
  parseOAuthError,
} from './access'

describe('parseAllowlist', () => {
  it('returns an empty list for unset / blank input', () => {
    expect(parseAllowlist(undefined)).toEqual([])
    expect(parseAllowlist('')).toEqual([])
    expect(parseAllowlist('   ')).toEqual([])
  })

  it('splits on commas and/or whitespace and lowercases + trims', () => {
    expect(parseAllowlist('A@B.com, c@d.com')).toEqual(['a@b.com', 'c@d.com'])
    expect(parseAllowlist('a@b.com\n  c@d.com')).toEqual(['a@b.com', 'c@d.com'])
    expect(parseAllowlist(' Owner@Gmail.com ')).toEqual(['owner@gmail.com'])
  })
})

describe('isEmailAllowed', () => {
  it('allows everyone when the list is empty (no restriction)', () => {
    expect(isEmailAllowed('anyone@example.com', [])).toBe(true)
    expect(isEmailAllowed(null, [])).toBe(true)
    expect(isEmailAllowed(undefined, [])).toBe(true)
  })

  it('allows only listed emails, case-insensitively', () => {
    const list = ['owner@gmail.com', 'family@gmail.com']
    expect(isEmailAllowed('owner@gmail.com', list)).toBe(true)
    expect(isEmailAllowed('Owner@Gmail.com', list)).toBe(true)
    expect(isEmailAllowed('  family@gmail.com ', list)).toBe(true)
    expect(isEmailAllowed('stranger@gmail.com', list)).toBe(false)
  })

  it('denies a missing email when the list is non-empty', () => {
    expect(isEmailAllowed(null, ['owner@gmail.com'])).toBe(false)
    expect(isEmailAllowed(undefined, ['owner@gmail.com'])).toBe(false)
  })
})

describe('isOwnerEmail', () => {
  const list = ['owner@gmail.com', 'family@gmail.com']

  it('matches the explicit owner email case- and whitespace-insensitively', () => {
    expect(isOwnerEmail('owner@gmail.com', 'Owner@Gmail.com', list)).toBe(true)
    expect(isOwnerEmail('  owner@gmail.com ', 'owner@gmail.com', list)).toBe(true)
    expect(isOwnerEmail('family@gmail.com', 'owner@gmail.com', list)).toBe(false)
  })

  it('treats a single-email allowlist as the owner when no explicit owner is set', () => {
    expect(isOwnerEmail('solo@gmail.com', undefined, ['solo@gmail.com'])).toBe(true)
    expect(isOwnerEmail('other@gmail.com', undefined, ['solo@gmail.com'])).toBe(false)
  })

  it('makes nobody the auto-owner on a multi-email allowlist with no explicit owner', () => {
    expect(isOwnerEmail('owner@gmail.com', undefined, list)).toBe(false)
    expect(isOwnerEmail('family@gmail.com', undefined, list)).toBe(false)
    expect(isOwnerEmail('owner@gmail.com', '', list)).toBe(false)
  })

  it('denies a missing/blank email', () => {
    expect(isOwnerEmail(null, 'owner@gmail.com', list)).toBe(false)
    expect(isOwnerEmail(undefined, 'owner@gmail.com', list)).toBe(false)
    expect(isOwnerEmail('   ', 'owner@gmail.com', list)).toBe(false)
  })
})

describe('needsOnboarding', () => {
  it('is false while the profile is loading or being created', () => {
    expect(needsOnboarding(null)).toBe(false)
    expect(needsOnboarding(undefined)).toBe(false)
  })

  it('is true for a real profile with no onboarded_at, false once set', () => {
    expect(needsOnboarding({ onboarded_at: null })).toBe(true)
    expect(needsOnboarding({ onboarded_at: '2026-06-25T00:00:00Z' })).toBe(false)
  })
})

describe('parseOAuthError', () => {
  it('returns null when there is no error in the URL', () => {
    expect(parseOAuthError('', '')).toBeNull()
    expect(parseOAuthError('?code=abc', '')).toBeNull()
  })

  it('gives a tailored message for a disabled-signups redirect (query or hash)', () => {
    const search =
      '?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance'
    expect(parseOAuthError(search, '')).toContain('sign-ups are disabled')
    expect(parseOAuthError('', search.replace(/^\?/, '#'))).toContain(
      'sign-ups are disabled',
    )
  })

  it('falls back to the decoded error_description, then error', () => {
    expect(
      parseOAuthError('?error=server_error&error_description=Something+broke', ''),
    ).toBe('Something broke')
    expect(parseOAuthError('?error=access_denied', '')).toBe('access_denied')
  })
})
