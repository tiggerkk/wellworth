import { describe, expect, it } from 'vitest'
import { DEFAULT_DYNASTY, DYNASTIES } from './dynasty'

describe('DYNASTIES', () => {
  it('lists 全部 then the twelve dynasties newest → oldest in the specified order', () => {
    expect([...DYNASTIES]).toEqual([
      '全部',
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

  it('defaults to the leading 全部 value', () => {
    expect(DEFAULT_DYNASTY).toBe('全部')
    expect(DEFAULT_DYNASTY).toBe(DYNASTIES[0])
  })
})
