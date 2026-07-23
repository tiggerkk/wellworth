import { describe, expect, it } from 'vitest'
import {
  addProvider,
  defaultCurrencyFor,
  defaultProviders,
  effectiveProviders,
  generateKey,
  matchKeyOrLabel,
  providerLabel,
  removeProvider,
  renameProvider,
  reorderProviders,
  setProviderCurrency,
} from './insurance-config'

describe('effectiveProviders', () => {
  it('falls back to seed defaults for NULL / empty / invalid overrides', () => {
    const seedKeys = defaultProviders().map((p) => p.key)
    expect(effectiveProviders(null).map((p) => p.key)).toEqual(seedKeys)
    expect(effectiveProviders(undefined).map((p) => p.key)).toEqual(seedKeys)
    expect(effectiveProviders([]).map((p) => p.key)).toEqual(seedKeys)
    expect(effectiveProviders('garbage').map((p) => p.key)).toEqual(seedKeys)
    // entries missing key/label are dropped → empty → defaults
    expect(effectiveProviders([{ label: 'no key' }]).map((p) => p.key)).toEqual(seedKeys)
  })

  it('is authoritative for a non-null override (no resurrection of deleted defaults)', () => {
    const override = [{ key: 'aia', label: 'AIA', defaultCurrency: 'USD' }]
    const list = effectiveProviders(override)
    expect(list).toEqual([{ key: 'aia', label: 'AIA', defaultCurrency: 'USD' }])
  })

  it('defaults a missing/garbled currency to base (HKD) and dedupes by key', () => {
    const list = effectiveProviders([
      { key: 'aia', label: 'AIA' }, // no currency
      { key: 'aia', label: 'AIA Dup', defaultCurrency: 'USD' }, // duplicate key dropped
      { key: 'x', label: 'X', defaultCurrency: 'JPY' }, // invalid currency → HKD
    ])
    expect(list).toEqual([
      { key: 'aia', label: 'AIA', defaultCurrency: 'HKD' },
      { key: 'x', label: 'X', defaultCurrency: 'HKD' },
    ])
  })
})

describe('lookups (orphan-tolerant)', () => {
  const list = defaultProviders()
  it('providerLabel falls back to the raw key', () => {
    expect(providerLabel(list, 'chubb')).toBe('CHUBB')
    expect(providerLabel(list, 'unknown_key')).toBe('unknown_key')
  })
  it('defaultCurrencyFor falls back to base', () => {
    expect(defaultCurrencyFor(list, 'manulife')).toBe('HKD')
    expect(defaultCurrencyFor(list, 'unknown_key')).toBe('HKD')
  })
  it('matchKeyOrLabel matches by key or label, case-insensitive', () => {
    expect(matchKeyOrLabel(list, 'CHUBB')).toBe('chubb')
    expect(matchKeyOrLabel(list, 'manulife')).toBe('manulife')
    expect(matchKeyOrLabel(list, 'BOC')).toBe('boc')
    expect(matchKeyOrLabel(list, 'nope')).toBeNull()
    expect(matchKeyOrLabel(list, '')).toBeNull()
  })
})

describe('generateKey', () => {
  it('slugifies and de-collides with a numeric suffix', () => {
    expect(generateKey('AIA International', [])).toBe('aia_international')
    expect(generateKey('AIA', ['aia'])).toBe('aia_2')
    expect(generateKey('AIA', ['aia', 'aia_2'])).toBe('aia_3')
    expect(generateKey('!!!', ['provider'])).toBe('provider_2')
  })
})

describe('pure transforms', () => {
  it('add / rename / setCurrency / remove / reorder', () => {
    let list = defaultProviders()
    list = addProvider(list, 'AIA')
    expect(list.at(-1)).toEqual({
      key: 'aia',
      label: 'AIA',
      defaultCurrency: 'HKD',
      color: 'var(--color-med-stool)', // first swatch unused by the 3 seed providers
    })

    list = renameProvider(list, 'aia', 'AIA HK')
    expect(providerLabel(list, 'aia')).toBe('AIA HK')

    list = setProviderCurrency(list, 'aia', 'USD')
    expect(defaultCurrencyFor(list, 'aia')).toBe('USD')

    const order = ['aia', ...defaultProviders().map((p) => p.key)]
    list = reorderProviders(list, order)
    expect(list.map((p) => p.key)).toEqual(order)

    list = removeProvider(list, 'aia')
    expect(list.some((p) => p.key === 'aia')).toBe(false)
  })
})
