import { describe, expect, it } from 'vitest'
import { draftAmount } from './wellness-quantity'

describe('draftAmount', () => {
  it('returns the parsed number for valid input', () => {
    expect(draftAmount('1.5', 1)).toBe(1.5)
    expect(draftAmount('0', 1)).toBe(0)
    expect(draftAmount('45', 30)).toBe(45)
  })

  it('falls back when blank, non-numeric, or negative', () => {
    expect(draftAmount('', 1)).toBe(1)
    expect(draftAmount('   ', 1)).toBe(1)
    expect(draftAmount('abc', 1)).toBe(1)
    expect(draftAmount('-3', 1)).toBe(1)
    expect(draftAmount('', 30)).toBe(30)
  })
})
