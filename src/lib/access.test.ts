import { describe, expect, it } from 'vitest'
import { isEmailAllowed, parseAllowlist, parseOAuthError } from './access'

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
