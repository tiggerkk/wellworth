import { describe, expect, it } from 'vitest'
import { isStorable, withSavedIds, type ServingDraft } from './wellness-servings'

describe('isStorable', () => {
  it('needs a non-blank name and positive grams', () => {
    expect(isStorable({ name: '1 cup', grams: 240 })).toBe(true)
    expect(isStorable({ name: '  ', grams: 240 })).toBe(false)
    expect(isStorable({ name: '1 cup', grams: 0 })).toBe(false)
    expect(isStorable({ name: '1 cup', grams: -5 })).toBe(false)
  })
})

describe('withSavedIds', () => {
  it('stamps ids onto id-less rows in order', () => {
    const list = [
      { name: '1 cup', grams: 240 },
      { name: '100 g', grams: 100 },
    ]
    expect(withSavedIds(list, [{ id: 's1' }, { id: 's2' }])).toEqual([
      { id: 's1', name: '1 cup', grams: 240 },
      { id: 's2', name: '100 g', grams: 100 },
    ])
  })

  it('aligns saved ids to storable rows only, leaving blank or zero-gram rows id-less', () => {
    const list: ServingDraft[] = [
      { name: '1 cup', grams: 240 },
      { name: '', grams: 50 },
      { name: 'slice', grams: 0 },
      { name: '100 g', grams: 100 },
    ]
    const out = withSavedIds(list, [{ id: 's1' }, { id: 's2' }])
    expect(out.map((r) => r.id)).toEqual(['s1', undefined, undefined, 's2'])
  })

  it('keeps an existing id when a storable row has no matching saved row', () => {
    const list: ServingDraft[] = [{ id: 'old', name: '1 cup', grams: 240 }]
    expect(withSavedIds(list, [])[0]?.id).toBe('old')
  })

  it('does not mutate its input and preserves extra fields', () => {
    const list = [{ name: '1 cup', grams: 240, note: 'x' }]
    const out = withSavedIds(list, [{ id: 's1' }])
    expect(list[0]).not.toHaveProperty('id')
    expect(out[0]).toEqual({ id: 's1', name: '1 cup', grams: 240, note: 'x' })
  })

  it('is idempotent, so applying the same save twice leaves the list unchanged', () => {
    const list = [
      { name: '1 cup', grams: 240 },
      { name: '', grams: 0 },
      { name: '100 g', grams: 100 },
    ]
    const saved = [{ id: 's1' }, { id: 's2' }]
    const once = withSavedIds(list, saved)
    expect(withSavedIds(once, saved)).toEqual(once)
  })
})
