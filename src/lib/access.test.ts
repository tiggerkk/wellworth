import { describe, expect, it } from 'vitest'
import { isEmailAllowed, parseAllowlist } from './access'

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
