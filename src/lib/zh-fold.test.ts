import { describe, expect, it } from 'vitest'
import { foldZh } from './zh-fold'

describe('foldZh', () => {
  it('folds representative many-to-one Traditional chars to Simplified', () => {
    expect(foldZh('後')).toBe('后')
    expect(foldZh('麼')).toBe('么')
    expect(foldZh('們')).toBe('们')
    expect(foldZh('學')).toBe('学')
  })

  it('folds both HK (裏) and TW (裡) variants to the same Simplified 里', () => {
    expect(foldZh('裏')).toBe('里')
    expect(foldZh('裡')).toBe('里')
  })

  it('folds a whole Traditional title to its Simplified form', () => {
    expect(foldZh('紅樓夢')).toBe('红楼梦')
  })

  it('makes either input variant share one canonical key (the basis for variant-agnostic search)', () => {
    // A Traditional query and Simplified stored text fold to the same string, so includes() matches.
    expect(foldZh('紅樓夢')).toBe(foldZh('红楼梦'))
  })

  it('lowercases Latin and leaves Simplified / non-CJK untouched', () => {
    expect(foldZh('The Matrix')).toBe('the matrix')
    expect(foldZh('红楼梦')).toBe('红楼梦')
    expect(foldZh('')).toBe('')
  })

  it('handles mixed CJK + Latin strings', () => {
    expect(foldZh('紅樓夢 DREAM')).toBe('红楼梦 dream')
  })
})
