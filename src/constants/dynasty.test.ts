import { describe, expect, it } from 'vitest'
import { DEFAULT_DYNASTY, DYNASTIES } from './dynasty'

describe('DYNASTIES', () => {
  it('lists the twelve dynasties newest → oldest in the specified order', () => {
    expect([...DYNASTIES]).toEqual([
      '近代',
      '清代',
      '明代',
      '元代',
      '宋代',
      '五代',
      '唐代',
      '隋代',
      '南北朝',
      '魏晉',
      '兩漢',
      '先秦',
    ])
  })

  it('defaults to the first (newest) value', () => {
    expect(DEFAULT_DYNASTY).toBe('近代')
    expect(DEFAULT_DYNASTY).toBe(DYNASTIES[0])
  })
})
