import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { parseNetWorthCsv, stripNumber } from './networth-import'

const HEADER =
  'asset_type,name,currency,value_native,detail1_key,detail1_value,detail2_key,detail2_value'

describe('stripNumber', () => {
  it('removes thousands commas and surrounding quotes', () => {
    expect(stripNumber('"8,466,568.80"')).toBe('8466568.80')
    expect(stripNumber('546733.53')).toBe('546733.53')
    expect(stripNumber('  1,000 ')).toBe('1000')
  })
})

describe('parseNetWorthCsv', () => {
  it('parses currencies, strips commas, and maps detail pairs', () => {
    const csv = [
      HEADER,
      'cash,Bank HKD,HKD,"500,000.00",,,,',
      'cash,Bank CNY,CNY,"6,399.41",,,,',
      'stock,HPE,USD,"41,420.61",ticker,HPE,shares,859.88',
      'insurance,Policy,USD,"25,000.00",premium,"3,000.00",policy_year,5.00',
    ].join('\n')
    const result = parseNetWorthCsv(parseCsv(csv))
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(4)

    expect(result.rows[1]).toMatchObject({ currency: 'CNY', value_native: 6399.41 })
    expect(result.rows[2]).toMatchObject({
      asset_type: 'stock',
      currency: 'USD',
      value_native: 41420.61,
      details: { ticker: 'HPE', shares: '859.88' },
    })
    // detail values are comma-stripped too
    expect(result.rows[3]?.details).toEqual({ premium: '3000.00', policy_year: '5.00' })
  })

  it('skips rows with a bad asset_type, currency, or value', () => {
    const csv = [
      HEADER,
      'crypto,Bad Type,HKD,100,,,,',
      'cash,Bad Currency,GBP,100,,,,',
      'cash,Bad Value,HKD,abc,,,,',
      'cash,Missing Name,HKD,,,,,'.replace('Missing Name', ''),
      'cash,Good,HKD,"1,000",,,,',
    ].join('\n')
    const result = parseNetWorthCsv(parseCsv(csv))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ name: 'Good', value_native: 1000 })
    expect(result.errors).toHaveLength(4)
  })

  it('normalizes case and skips blank lines', () => {
    const csv = [HEADER, 'CASH,Lower,cny,50,,,,', '', '   ,,,,,,,'].join('\n')
    const result = parseNetWorthCsv(parseCsv(csv))
    expect(result.rows).toEqual([
      {
        asset_type: 'cash',
        name: 'Lower',
        currency: 'CNY',
        value_native: 50,
        details: {},
      },
    ])
  })

  it('errors on missing required columns and empty input', () => {
    expect(parseNetWorthCsv([]).errors[0]).toMatch(/empty/i)
    expect(parseNetWorthCsv(parseCsv('name,currency\nx,HKD')).errors[0]).toMatch(
      /asset_type/,
    )
  })
})
