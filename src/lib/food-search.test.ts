import { describe, expect, it } from 'vitest'
import { foodMatchScore, singularize, toUsdaWildcardQuery } from './food-search'

describe('singularize', () => {
  it('handles -ies, -es, and -s plurals', () => {
    expect(singularize('blueberries')).toBe('blueberry')
    expect(singularize('muffins')).toBe('muffin')
    expect(singularize('peaches')).toBe('peach')
    expect(singularize('boxes')).toBe('box')
  })

  it('leaves short words and -ss words alone', () => {
    expect(singularize('oats')).toBe('oat')
    expect(singularize('is')).toBe('is')
    expect(singularize('glass')).toBe('glass')
  })
})

describe('toUsdaWildcardQuery', () => {
  it('reduces partial/singular/plural forms of a word to one wildcard stem', () => {
    expect(toUsdaWildcardQuery('blueberry')).toBe('blueberr*')
    expect(toUsdaWildcardQuery('blueberries')).toBe('blueberr*')
    expect(toUsdaWildcardQuery('blueberrie')).toBe('blueberr*')
    expect(toUsdaWildcardQuery('blueberr')).toBe('blueberr*')
    expect(toUsdaWildcardQuery('blueber')).toBe('blueber*')
  })

  it('only wildcards the last (still-being-typed) word', () => {
    expect(toUsdaWildcardQuery('chicken brea')).toBe('chicken brea*')
    expect(toUsdaWildcardQuery('  egg  ')).toBe('egg*')
  })

  it('keeps the whole word when the stem would be too short', () => {
    expect(toUsdaWildcardQuery('pie')).toBe('pie*')
    expect(toUsdaWildcardQuery('soy')).toBe('soy*')
  })

  it('returns empty for blank input', () => {
    expect(toUsdaWildcardQuery('   ')).toBe('')
  })
})

describe('foodMatchScore', () => {
  it('puts exact and leading-prefix matches in the same top tier (nutrient count breaks ties)', () => {
    // A bare "BLUEBERRIES" must not outrank "Blueberries, raw" on name alone.
    expect(foodMatchScore('BLUEBERRIES', 'blueberry')).toBe(4)
    expect(foodMatchScore('Blueberries, raw', 'blueberry')).toBe(4)
    expect(foodMatchScore('Blueberries', 'blueberry')).toBe(4)
  })

  it('ranks leading > later-word > substring', () => {
    expect(foodMatchScore('Blueberry juice', 'blueberry')).toBe(4)
    expect(foodMatchScore('Muffins, blueberry', 'blueberry')).toBe(2)
    expect(foodMatchScore('Superblueberry bar', 'blueberry')).toBe(1)
  })

  it('tolerates partial typing as the word is built up', () => {
    // "Blueberries, raw" starts with every prefix the user types toward "blueberries".
    for (const partial of ['bluebe', 'blueber', 'blueberr', 'blueberri', 'blueberrie']) {
      expect(foodMatchScore('Blueberries, raw', partial)).toBeGreaterThan(0)
    }
    // Singular-named foods match prefixes of the singular form.
    for (const partial of ['bluebe', 'blueber', 'blueberr']) {
      expect(foodMatchScore('Blueberry juice', partial)).toBeGreaterThan(0)
    }
  })

  it('is plural/singular and punctuation insensitive', () => {
    expect(foodMatchScore('Pie, blueberry', 'Blueberry')).toBe(2)
    expect(foodMatchScore('Blueberries, raw', 'blueberries')).toBe(4)
    expect(foodMatchScore('Eggs', 'egg')).toBe(4)
    expect(foodMatchScore('Egg, whole', 'eggs')).toBe(4)
  })

  it('returns 0 for non-matches and empty queries', () => {
    expect(foodMatchScore('Apple, raw', 'blueberries')).toBe(0)
    expect(foodMatchScore('Rich chocolate', 'rice')).toBe(0)
    expect(foodMatchScore('Anything', '   ')).toBe(0)
  })

  it('matches multi-word queries when all words match a name word', () => {
    expect(foodMatchScore('Muffins, blueberry, dry mix', 'blueberry muffin')).toBe(1)
    expect(foodMatchScore('Apple pie', 'blueberry muffin')).toBe(0)
  })
})
