import { describe, expect, it } from 'vitest'
import { JOURNAL_MOODS } from '../constants/journal'
import {
  defaultMoods,
  effectiveMoods,
  matchMoodKeyOrLabel,
  moodColor,
  moodLabel,
  moodSubTags,
  recolorMood,
  renameMood,
  resubTagMood,
} from './journal-moods'

describe('defaultMoods', () => {
  it('returns exactly the 7 canonical moods, in fixed order', () => {
    expect(defaultMoods().map((m) => m.key)).toEqual(JOURNAL_MOODS)
  })
})

describe('effectiveMoods', () => {
  it('falls back to defaults for a null/empty override', () => {
    expect(effectiveMoods(null)).toEqual(defaultMoods())
    expect(effectiveMoods([])).toEqual(defaultMoods())
  })

  it('always returns exactly 7 entries, one per canonical key, even from a partial override', () => {
    const list = effectiveMoods([
      { key: 'happy', label: 'Joyful', color: '#111', subTags: [] },
    ])
    expect(list.map((m) => m.key)).toEqual(JOURNAL_MOODS)
    expect(list.find((m) => m.key === 'happy')?.label).toBe('Joyful')
    // Every other key falls back to its own default independently.
    expect(list.find((m) => m.key === 'sad')).toEqual(
      defaultMoods().find((m) => m.key === 'sad'),
    )
  })

  it('ignores an unknown key in the override', () => {
    const list = effectiveMoods([{ key: 'ecstatic', label: 'Ecstatic' }])
    expect(list.map((m) => m.key)).toEqual(JOURNAL_MOODS)
  })
})

describe('moodLabel / moodColor / moodSubTags', () => {
  const list = defaultMoods()

  it('reads the configured value for a known key', () => {
    expect(moodLabel(list, 'happy')).toBe('Happy')
    expect(moodColor(list, 'happy')).toBeTruthy()
    expect(moodSubTags(list, 'happy')).toContain('grateful')
  })

  it('falls back tolerantly for an orphan key', () => {
    expect(moodLabel(list, 'made_up')).toBe('made_up')
    expect(moodSubTags(list, 'made_up')).toEqual([])
  })
})

describe('renameMood / recolorMood / resubTagMood', () => {
  const list = defaultMoods()

  it('renames only the targeted mood', () => {
    const next = renameMood(list, 'happy', 'Joyful')
    expect(next.find((m) => m.key === 'happy')?.label).toBe('Joyful')
    expect(next.find((m) => m.key === 'sad')?.label).toBe('Sad')
  })

  it('ignores a blank rename', () => {
    expect(renameMood(list, 'happy', '   ')).toEqual(list)
  })

  it('recolors only the targeted mood', () => {
    const next = recolorMood(list, 'angry', '#123456')
    expect(next.find((m) => m.key === 'angry')?.color).toBe('#123456')
  })

  it("updates only the targeted mood's sub-tags", () => {
    const next = resubTagMood(list, 'calm', ['zen'])
    expect(next.find((m) => m.key === 'calm')?.subTags).toEqual(['zen'])
    expect(next.find((m) => m.key === 'happy')?.subTags).toEqual(
      list.find((m) => m.key === 'happy')?.subTags,
    )
  })
})

describe('matchMoodKeyOrLabel', () => {
  const list = defaultMoods()

  it('matches by key, case-insensitively', () => {
    expect(matchMoodKeyOrLabel(list, 'HAPPY')).toBe('happy')
  })

  it('matches by label, case-insensitively', () => {
    expect(matchMoodKeyOrLabel(list, 'anxious')).toBe('anxious')
    expect(matchMoodKeyOrLabel(renameMood(list, 'happy', 'Joyful'), 'joyful')).toBe(
      'happy',
    )
  })

  it('returns null for no match or a blank cell', () => {
    expect(matchMoodKeyOrLabel(list, 'ecstatic')).toBeNull()
    expect(matchMoodKeyOrLabel(list, '')).toBeNull()
  })
})
