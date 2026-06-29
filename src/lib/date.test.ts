import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  fromIsoDate,
  formatDayLabel,
  formatFullDate,
  formatMonthDay,
  startOfMonth,
  toIsoDate,
} from './date'

describe('toIsoDate / fromIsoDate', () => {
  it('round-trips a local civil date without UTC drift', () => {
    expect(fromIsoDate('2026-06-13').getFullYear()).toBe(2026)
    expect(fromIsoDate('2026-06-13').getMonth()).toBe(5) // June, 0-based
    expect(fromIsoDate('2026-06-13').getDate()).toBe(13)
    expect(toIsoDate(fromIsoDate('2026-06-13'))).toBe('2026-06-13')
  })
})

describe('formatMonthDay', () => {
  it('shows month + day only, with no weekday or relative label', () => {
    expect(formatMonthDay('2026-06-13')).toBe('Jun 13')
    expect(formatMonthDay('2026-12-01')).toBe('Dec 1')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries correctly', () => {
    expect(addDays('2026-06-13', 1)).toBe('2026-06-14')
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('formatFullDate', () => {
  it('shows month, day, and year (MMM DD, YYYY)', () => {
    expect(formatFullDate('2026-06-13')).toBe('Jun 13, 2026')
    expect(formatFullDate('2026-12-01')).toBe('Dec 1, 2026')
  })
})

describe('formatDayLabel', () => {
  it('uses relative labels around today, else MMM DD, YYYY', () => {
    expect(formatDayLabel('2026-06-13', '2026-06-13')).toBe('Today')
    expect(formatDayLabel('2026-06-12', '2026-06-13')).toBe('Yesterday')
    expect(formatDayLabel('2026-06-14', '2026-06-13')).toBe('Tomorrow')
    expect(formatDayLabel('2026-06-20', '2026-06-13')).toBe('Jun 20, 2026')
  })
})

describe('startOfMonth / addMonths', () => {
  it('navigates months', () => {
    expect(startOfMonth('2026-06-13')).toBe('2026-06-01')
    expect(addMonths('2026-06-13', 1)).toBe('2026-07-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })
})
