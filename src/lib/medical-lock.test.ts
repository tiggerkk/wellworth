import { describe, expect, it } from 'vitest'
import {
  hashPin,
  isIdleExpired,
  isValidPin,
  timeoutToValue,
  valueToTimeoutMinutes,
  verifyPin,
} from './medical-lock'

describe('PIN hashing', () => {
  it('verifies the correct PIN and rejects a wrong one', async () => {
    const stored = await hashPin('1234')
    expect(stored.startsWith('pbkdf2$')).toBe(true)
    expect(stored).not.toContain('1234')
    expect(await verifyPin('1234', stored)).toBe(true)
    expect(await verifyPin('1235', stored)).toBe(false)
  })

  it('uses a fresh salt each time (same PIN → different stored hash)', async () => {
    const a = await hashPin('4321')
    const b = await hashPin('4321')
    expect(a).not.toEqual(b)
    expect(await verifyPin('4321', a)).toBe(true)
    expect(await verifyPin('4321', b)).toBe(true)
  })

  it('returns false for a malformed stored string', async () => {
    expect(await verifyPin('1234', 'not-a-hash')).toBe(false)
    expect(await verifyPin('1234', 'pbkdf2$abc$x$y')).toBe(false)
    expect(await verifyPin('1234', '')).toBe(false)
  })
})

describe('isValidPin', () => {
  it('accepts 4–8 digits, rejects everything else', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('12345678')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('123456789')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
    expect(isValidPin('')).toBe(false)
  })
})

describe('isIdleExpired', () => {
  const now = 1_000_000
  it('never expires for Indefinite (null)', () => {
    expect(isIdleExpired(0, now, null)).toBe(false)
  })
  it('expires once the gap reaches the timeout', () => {
    expect(isIdleExpired(now - 4 * 60_000, now, 5)).toBe(false)
    expect(isIdleExpired(now - 5 * 60_000, now, 5)).toBe(true)
    expect(isIdleExpired(now - 6 * 60_000, now, 5)).toBe(true)
  })
  it('treats 0 minutes as immediately expired for any positive gap', () => {
    expect(isIdleExpired(now - 1, now, 0)).toBe(true)
    expect(isIdleExpired(now, now, 0)).toBe(true)
  })
})

describe('timeout value mapping', () => {
  it('round-trips minutes ↔ select value', () => {
    expect(timeoutToValue(null)).toBe('indefinite')
    expect(timeoutToValue(5)).toBe('5')
    expect(timeoutToValue(0)).toBe('0')
    expect(valueToTimeoutMinutes('indefinite')).toBeNull()
    expect(valueToTimeoutMinutes('5')).toBe(5)
    expect(valueToTimeoutMinutes('0')).toBe(0)
  })
})
