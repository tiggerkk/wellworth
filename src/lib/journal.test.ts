import { describe, expect, it } from 'vitest'
import {
  applyJournalView,
  DEFAULT_JOURNAL_CRITERIA,
  journalSearchText,
  rankedJournalTags,
  type JournalRow,
} from './journal'

function row(overrides: Partial<JournalRow> = {}): JournalRow {
  return {
    id: overrides.id ?? 'id-1',
    user_id: 'u1',
    day: '2026-06-13',
    journal_entry: 'A quiet day.',
    mood: 'neutral',
    tags: [],
    created_at: '2026-06-13T00:00:00Z',
    updated_at: '2026-06-13T00:00:00Z',
    ...overrides,
  }
}

describe('journalSearchText', () => {
  it('folds entry text and tags together, Traditional⇄Simplified agnostic', () => {
    const text = journalSearchText({ journal_entry: 'Went to 台北', tags: ['旅行'] })
    expect(text).toContain('旅行')
    expect(text).toContain('台北')
  })
})

describe('rankedJournalTags', () => {
  it('sorts by count desc, then tag asc', () => {
    const ranked = rankedJournalTags([
      row({ tags: ['work', 'gym'] }),
      row({ tags: ['work'] }),
      row({ tags: ['gym'] }),
      row({ tags: ['art'] }),
    ])
    expect(ranked).toEqual([
      { tag: 'gym', count: 2 },
      { tag: 'work', count: 2 },
      { tag: 'art', count: 1 },
    ])
  })

  it('returns an empty list for no entries', () => {
    expect(rankedJournalTags([])).toEqual([])
  })
})

describe('applyJournalView', () => {
  const entries = [
    row({
      id: 'a',
      day: '2026-06-13',
      journal_entry: 'Rested for less than a week.',
      mood: 'calm',
      tags: ['rest'],
    }),
    row({
      id: 'b',
      day: '2026-04-12',
      journal_entry: 'Played with an AI app.',
      mood: 'happy',
      tags: ['ai', 'poems'],
    }),
    row({
      id: 'c',
      day: '2026-04-06',
      journal_entry: 'Finally decided to learn more about AI!',
      mood: 'motivated',
      tags: ['ai'],
    }),
  ]

  it('defaults to date desc', () => {
    const view = applyJournalView(entries, DEFAULT_JOURNAL_CRITERIA)
    expect(view.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts date asc when requested', () => {
    const view = applyJournalView(entries, {
      ...DEFAULT_JOURNAL_CRITERIA,
      sortDir: 'asc',
    })
    expect(view.map((e) => e.id)).toEqual(['c', 'b', 'a'])
  })

  it('filters by query against entry text and tags', () => {
    const view = applyJournalView(entries, { ...DEFAULT_JOURNAL_CRITERIA, query: 'rest' })
    expect(view.map((e) => e.id)).toEqual(['a'])
  })

  it('filters by tags with OR semantics', () => {
    const view = applyJournalView(entries, {
      ...DEFAULT_JOURNAL_CRITERIA,
      tags: ['poems'],
    })
    expect(view.map((e) => e.id)).toEqual(['b'])
  })

  it('filters by mood', () => {
    const view = applyJournalView(entries, { ...DEFAULT_JOURNAL_CRITERIA, mood: 'happy' })
    expect(view.map((e) => e.id)).toEqual(['b'])
  })

  it("'all' mood matches every entry", () => {
    const view = applyJournalView(entries, { ...DEFAULT_JOURNAL_CRITERIA, mood: 'all' })
    expect(view).toHaveLength(3)
  })

  it('filters by an inclusive date range', () => {
    const view = applyJournalView(entries, {
      ...DEFAULT_JOURNAL_CRITERIA,
      dateFrom: '2026-04-10',
      dateTo: '2026-06-01',
    })
    expect(view.map((e) => e.id)).toEqual(['b'])
  })

  it('combines query, tags, and date range', () => {
    const view = applyJournalView(entries, {
      ...DEFAULT_JOURNAL_CRITERIA,
      query: 'ai',
      tags: ['ai'],
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    })
    expect(view.map((e) => e.id).sort()).toEqual(['b', 'c'])
  })
})
