import { describe, expect, it } from 'vitest'
import { computeJournalStats, topMood } from './journal-stats'

describe('computeJournalStats', () => {
  it('counts total entries and this-month entries', () => {
    const stats = computeJournalStats(
      ['2026-06-01', '2026-06-13', '2026-05-30'],
      '2026-06-13',
    )
    expect(stats.totalEntries).toBe(3)
    expect(stats.entriesThisMonth).toBe(2)
  })

  it('current streak counts back from today when today has an entry', () => {
    const stats = computeJournalStats(
      ['2026-06-11', '2026-06-12', '2026-06-13'],
      '2026-06-13',
    )
    expect(stats.currentStreak).toBe(3)
  })

  it('current streak counts back from yesterday when today has no entry yet', () => {
    const stats = computeJournalStats(['2026-06-11', '2026-06-12'], '2026-06-13')
    expect(stats.currentStreak).toBe(2)
  })

  it('current streak is 0 after a gap', () => {
    const stats = computeJournalStats(['2026-06-01'], '2026-06-13')
    expect(stats.currentStreak).toBe(0)
  })

  it('longest streak finds the best run, even if not the current one', () => {
    const stats = computeJournalStats(
      ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-10'],
      '2026-06-13',
    )
    expect(stats.longestStreak).toBe(3)
    expect(stats.currentStreak).toBe(0)
  })

  it('tolerates unsorted/duplicate input', () => {
    const stats = computeJournalStats(
      ['2026-06-13', '2026-06-11', '2026-06-11', '2026-06-12'],
      '2026-06-13',
    )
    expect(stats.totalEntries).toBe(3)
    expect(stats.currentStreak).toBe(3)
  })

  it('handles an empty history', () => {
    const stats = computeJournalStats([], '2026-06-13')
    expect(stats).toEqual({
      totalEntries: 0,
      currentStreak: 0,
      longestStreak: 0,
      entriesThisMonth: 0,
    })
  })
})

describe('topMood', () => {
  const order = ['happy', 'motivated', 'calm', 'neutral', 'sad', 'anxious', 'angry']

  it('picks the highest count', () => {
    expect(topMood({ happy: 2, sad: 5, calm: 1 }, order)).toBe('sad')
  })

  it('breaks ties by the fixed display order', () => {
    expect(topMood({ sad: 3, happy: 3 }, order)).toBe('happy')
  })

  it('returns null for an empty map', () => {
    expect(topMood({}, order)).toBeNull()
  })
})
