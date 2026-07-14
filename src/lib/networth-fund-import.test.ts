import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { parseFundCsv } from './networth-fund-import'

const HEADER =
  'Fund Name,Account,Asset Class,Total Holdings,Base Currency,Avg. Unit Cost,NAV Per Unit (As of Date),Total Cost,Total Value,Return Rate%,Profit/Loss'

describe('parseFundCsv', () => {
  it('parses an HKD fund, splitting NAV + as-of date and stripping prefixes/commas', () => {
    const csv = [
      HEADER,
      '"JPM China A (dist) - HKD",Master Account,Asia Pacific Equity,"9,219.317",HKD,HKD 27.18,"HKD 16.43(2026/06/25)","HKD 250,581.04","HKD 151,473.38",-39.55%,"HKD -99,107.66"',
    ].join('\n')
    const { rows, errors } = parseFundCsv(parseCsv(csv))
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'JPM China A (dist) - HKD',
      asset_class: 'Asia Pacific Equity',
      currency: 'HKD',
      units: 9219.317,
      avg_cost: 27.18,
      nav: 16.43,
      nav_as_of: '2026/06/25',
      total_cost: 250581.04,
      value_hkd: 151473.38,
      return_rate: -39.55,
      pnl: -99107.66,
    })
  })

  it('handles a USD fund and a NAV cell with an embedded newline + positive signs', () => {
    const csv = [
      HEADER,
      '"JPM Global High Yield",Master Account,Bond & Balanced,131.281,USD,USD 69.87,"USD 81.17\n(2026/06/25)","HKD 71,929.69","HKD 83,562.85",+16.17%,"HKD +11,633.15"',
    ].join('\n')
    const { rows } = parseFundCsv(parseCsv(csv))
    expect(rows[0]).toMatchObject({
      currency: 'USD',
      nav: 81.17,
      nav_as_of: '2026/06/25',
      value_hkd: 83562.85,
      return_rate: 16.17,
      pnl: 11633.15,
    })
  })

  it('stops at the blank row + footer', () => {
    const csv = [
      HEADER,
      '"Fund A",Master Account,Equity,1,HKD,HKD 1,HKD 1(2026/06/25),HKD 1,"HKD 100",0%,HKD 0',
      '',
      'Downloaded on:,27 Jun 2026 16:30 pm',
      'This page is not an official statement.',
    ].join('\n')
    const { rows } = parseFundCsv(parseCsv(csv))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('Fund A')
  })

  it('errors on a missing required column', () => {
    expect(parseFundCsv(parseCsv('Fund Name,Total Value\nx,1')).errors[0]).toMatch(
      /Missing/,
    )
  })

  it('accepts a CNY base-currency fund (value still HKD)', () => {
    const csv = [
      HEADER,
      '"JPM China A (CNY)",Master Account,Asia Pacific Equity,100,CNY,CNY 10,"CNY 12(2026/06/25)","HKD 1,000","HKD 1,300",30%,"HKD 300"',
    ].join('\n')
    const { rows, errors } = parseFundCsv(parseCsv(csv))
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ currency: 'CNY', value_hkd: 1300 })
  })

  it('rejects an unsupported base currency', () => {
    const csv = [
      HEADER,
      '"Euro Fund",Master Account,Equity,1,EUR,EUR 1,EUR 1(2026/06/25),HKD 1,"HKD 100",0%,HKD 0',
    ].join('\n')
    expect(parseFundCsv(parseCsv(csv)).errors[0]).toMatch(/HKD, CNY, or USD/)
  })
})
