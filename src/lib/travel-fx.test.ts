import { describe, expect, it } from 'vitest'
import { tripFirstDay } from './travel-fx'
import { todayLocal } from './date'

describe('tripFirstDay', () => {
  it('prefers the trip start_date', () => {
    expect(tripFirstDay({ start_date: '2026-03-28' }, ['2026-04-01', null])).toBe(
      '2026-03-28',
    )
  })
  it('falls back to the earliest dated expense', () => {
    expect(tripFirstDay({ start_date: null }, ['2026-04-01', '2026-03-15', null])).toBe(
      '2026-03-15',
    )
  })
  it('falls back to today when nothing is dated', () => {
    expect(tripFirstDay({ start_date: null }, [null, null])).toBe(todayLocal())
  })
})
