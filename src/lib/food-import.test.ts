import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { parseFoodCsv } from './food-import'

const KNOWN = new Set([
  'energy',
  'protein',
  'carbs',
  'fiber',
  'fat',
  'vitamin_d',
  'magnesium',
  'net_carbs',
])

const parse = (csv: string) => parseFoodCsv(parseCsv(csv), KNOWN)

describe('parseFoodCsv', () => {
  it('errors on an empty file', () => {
    expect(parse('').errors[0]).toMatch(/empty/i)
  })

  it('errors when the name column is missing', () => {
    expect(parse('type,energy\nfood,100').errors[0]).toMatch(/name/i)
  })

  it('maps a basic food row with defaults and nutrients', () => {
    const { records, errors } = parse('name,energy,protein\nOats,389,17')
    expect(errors).toEqual([])
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      name: 'Oats',
      type: 'food',
      nutrient_basis: 'per_100g',
      is_favorite: false,
      nutrients: { energy: 389, protein: 17 },
      servings: [],
    })
  })

  it('parses type, basis, favorite, and servings', () => {
    const csv =
      'name,type,nutrient_basis,is_favorite,serving1_name,serving1_grams,vitamin_d\n' +
      'D3,supplement,per_serving,true,1 capsule,0.3,25'
    const { records } = parse(csv)
    expect(records[0]).toMatchObject({
      name: 'D3',
      type: 'supplement',
      nutrient_basis: 'per_serving',
      is_favorite: true,
      nutrients: { vitamin_d: 25 },
      servings: [{ name: '1 capsule', grams: 0.3 }],
    })
  })

  it('skips rows with an invalid type or basis', () => {
    const r = parse('name,type\nX,beverage')
    expect(r.records).toHaveLength(0)
    expect(r.errors[0]).toMatch(/type/i)
  })

  it('warns and ignores unknown and derived columns', () => {
    const r = parse('name,energy,vitamin_q,net_carbs\nX,10,5,3')
    expect(r.records[0]!.nutrients).toEqual({ energy: 10 })
    expect(r.warnings.join(' ')).toMatch(/vitamin_q/)
    expect(r.warnings.join(' ')).toMatch(/net_carbs/)
  })

  it('warns on non-numeric and negative nutrient values', () => {
    const r = parse('name,energy,protein\nX,abc,-3')
    expect(r.records[0]!.nutrients).toEqual({})
    expect(r.warnings).toHaveLength(2)
  })

  it('parses is_custom and defaults it to false', () => {
    const r = parse('name,is_custom,energy\nLocal Dish,true,200\nOats,,389')
    expect(r.records[0]).toMatchObject({ name: 'Local Dish', is_custom: true })
    expect(r.records[1]).toMatchObject({ name: 'Oats', is_custom: false })
  })

  it('resolves default_serving against a serving name', () => {
    const csv =
      'name,serving1_name,serving1_grams,serving2_name,serving2_grams,default_serving\n' +
      'Latte,1 cup,240,1 mug,350,1 mug'
    expect(parse(csv).records[0]!.default_serving_name).toBe('1 mug')
  })

  it('warns and nulls a default_serving that matches no serving', () => {
    const csv =
      'name,serving1_name,serving1_grams,default_serving\nLatte,1 cup,240,1 bowl'
    const r = parse(csv)
    expect(r.records[0]!.default_serving_name).toBeNull()
    expect(r.warnings.join(' ')).toMatch(/default_serving/)
  })

  it('skips an incomplete serving with a warning', () => {
    const r = parse('name,serving1_name,serving1_grams\nX,1 cup,')
    expect(r.records[0]!.servings).toEqual([])
    expect(r.warnings[0]).toMatch(/serving 1/)
  })

  it('skips blank lines and rows missing a name', () => {
    const r = parse('name,energy\n\n,50\nReal,10')
    expect(r.records).toHaveLength(1)
    expect(r.records[0]!.name).toBe('Real')
    expect(r.errors[0]).toMatch(/Row 3/) // the ",50" line is spreadsheet row 3
  })
})
