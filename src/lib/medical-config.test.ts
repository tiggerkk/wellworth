import { describe, expect, it } from 'vitest'
import { PALETTE_RED, PALETTE_BLUE } from '../constants/palette'
import {
  addReportType,
  effectiveReportTypes,
  defaultReportTypes,
  generateKey,
  matchKeyOrLabel,
  removeReportType,
  renameReportType,
  reorderReportTypes,
  reportTypeColor,
  reportTypeLabel,
} from './medical-config'
import { REPORT_TYPE_COLOR_FALLBACK, REPORT_TYPE_COLORS } from '../constants/medical'

describe('defaults', () => {
  it('seed report types in owner order', () => {
    expect(defaultReportTypes().map((e) => e.key)).toEqual([
      'health_screening',
      'mri',
      'ultrasound',
      'mammogram',
      'eye',
      'other',
    ])
  })
})

describe('effectiveReportTypes', () => {
  it('null / empty / all-invalid ⇒ defaults', () => {
    expect(effectiveReportTypes(null)).toEqual(defaultReportTypes())
    expect(effectiveReportTypes([])).toEqual(defaultReportTypes())
    expect(effectiveReportTypes('nope')).toEqual(defaultReportTypes())
    expect(effectiveReportTypes([{ nope: 1 }])).toEqual(defaultReportTypes())
  })
  it('a non-null override is authoritative — a deleted default does NOT resurrect', () => {
    const override = [
      { key: 'mri', label: 'MRI' },
      { key: 'eye', label: 'Eye' },
    ]
    expect(effectiveReportTypes(override).map((e) => e.key)).toEqual(['mri', 'eye'])
  })
  it('keeps custom keys and de-dupes by key', () => {
    const override = [
      { key: 'mri', label: 'MRI' },
      { key: 'mine', label: 'My Type' },
      { key: 'mri', label: 'Dupe' },
    ]
    expect(effectiveReportTypes(override).map((e) => e.key)).toEqual(['mri', 'mine'])
  })
})

describe('report type colours', () => {
  it('seed defaults each carry a palette colour', () => {
    const defaults = defaultReportTypes()
    expect(defaults.every((e) => typeof e.color === 'string' && e.color)).toBe(true)
    expect(defaults[0]!.color).toBe(REPORT_TYPE_COLORS[0]!.value)
  })
  it('reportTypeColor uses the saved colour, then position, then the orphan fallback', () => {
    const list = [
      { key: 'a', label: 'A', color: PALETTE_RED },
      { key: 'b', label: 'B' }, // legacy entry, no stored colour
    ]
    expect(reportTypeColor(list, 'a')).toBe(PALETTE_RED)
    expect(reportTypeColor(list, 'b')).toBe(REPORT_TYPE_COLORS[1]!.value) // position 1
    expect(reportTypeColor(list, 'gone')).toBe(REPORT_TYPE_COLOR_FALLBACK)
  })
  it('readEntry preserves a stored colour and drops a blank one', () => {
    const out = effectiveReportTypes([
      { key: 'a', label: 'A', color: PALETTE_BLUE },
      { key: 'b', label: 'B', color: '  ' },
    ])
    expect(out[0]!.color).toBe(PALETTE_BLUE)
    expect(out[1]!.color).toBeUndefined()
  })
  it('a new report type gets a distinct default colour not already in use', () => {
    const list = addReportType(defaultReportTypes(), 'Biopsy')
    const added = list[list.length - 1]!
    expect(typeof added.color).toBe('string')
    // defaults already consume the first 6 swatches, so the 7th is chosen.
    expect(added.color).toBe(REPORT_TYPE_COLORS[6]!.value)
  })
})

describe('tolerant lookups', () => {
  it('falls back to the raw key for an unknown/orphan value', () => {
    expect(reportTypeLabel(defaultReportTypes(), 'gone')).toBe('gone')
  })
  it('returns the configured label otherwise', () => {
    expect(reportTypeLabel(defaultReportTypes(), 'mri')).toBe('MRI')
  })
})

describe('matchKeyOrLabel', () => {
  const list = defaultReportTypes()
  it('matches by key or label, case-insensitive', () => {
    expect(matchKeyOrLabel(list, 'mri')).toBe('mri')
    expect(matchKeyOrLabel(list, 'MRI')).toBe('mri')
    expect(matchKeyOrLabel(list, '  Health Screening ')).toBe('health_screening')
  })
  it('returns null for an unknown or empty cell', () => {
    expect(matchKeyOrLabel(list, 'biopsy')).toBeNull()
    expect(matchKeyOrLabel(list, '')).toBeNull()
  })
})

describe('generateKey', () => {
  it('slugifies and uniquifies with a numeric suffix', () => {
    expect(generateKey('My Type!', [])).toBe('my_type')
    expect(generateKey('My Type!', ['my_type'])).toBe('my_type_2')
    expect(generateKey('My Type!', ['my_type', 'my_type_2'])).toBe('my_type_3')
  })
  it('falls back to "value" for an empty / symbol-only label', () => {
    expect(generateKey('   ', [])).toBe('value')
    expect(generateKey('中文', ['value'])).toBe('value_2')
  })
})

describe('transforms', () => {
  it('add generates a key and allows a duplicate label with a distinct key', () => {
    const list = addReportType(defaultReportTypes(), 'Eye')
    expect(list.filter((e) => e.label === 'Eye')).toHaveLength(2)
    expect(new Set(list.map((e) => e.key)).size).toBe(list.length)
  })
  it('rename changes only the label, preserving the key', () => {
    const list = renameReportType(defaultReportTypes(), 'mri', 'MRI Scan')
    expect(reportTypeLabel(list, 'mri')).toBe('MRI Scan')
    expect(list.some((e) => e.key === 'mri')).toBe(true)
  })
  it('remove drops the entry', () => {
    expect(
      removeReportType(defaultReportTypes(), 'mri').some((e) => e.key === 'mri'),
    ).toBe(false)
  })
  it('reorder respects the given key order and tolerates stale/missing keys', () => {
    const out = reorderReportTypes(defaultReportTypes(), ['other', 'mri', 'ghost'])
    expect(out.slice(0, 2).map((e) => e.key)).toEqual(['other', 'mri'])
    expect(out.map((e) => e.key).sort()).toEqual(
      defaultReportTypes()
        .map((e) => e.key)
        .sort(),
    )
  })
})
