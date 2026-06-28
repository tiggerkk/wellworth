import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { defaultProviders } from './insurance-config'
import {
  parseInsuranceBulkCsv,
  parseInsuranceSingleCsv,
  parseLooseDate,
} from './insurance-import'

// The CSV importers match provider labels against the owner's configured list; the tests use the
// seed defaults (CHUBB/BOC/Manulife). Provider key/label matching itself is covered in
// insurance-config.test.ts.
const PROVIDERS = defaultProviders()

describe('parseLooseDate', () => {
  it('parses loose dates', () => {
    expect(parseLooseDate('Aug 6, 2014')).toBe('2014-08-06')
    expect(parseLooseDate('Oct 7, 2015')).toBe('2015-10-07')
    expect(parseLooseDate('nope')).toBeNull()
  })
})

describe('parseInsuranceBulkCsv', () => {
  // Two 4-col policy blocks (CHUBB carried forward) + a trailing totals block (sub-header HKD).
  // The second block has no policy number → skipped. Age in col A.
  const SUB = 'Policy Year,Total Premium Paid,Cash Value,Surrender Gain %/Yr'
  const csv = [
    `,CHUBB,,,,,,,,Manulife,,,,Total Cash Values,`,
    `,Forever Diamond,,,,Elapsed Policy,,,,MyLegacy,,,,,`,
    `,"2150202771: Oct 7, 2015",,,,,,,,"28-9340140-4: Aug 8, 2003",,,,,`,
    `Age,${SUB},${SUB},${SUB},HKD`,
    `45,4,"60,000","37,276",-9.5,2,"50,000","31,559",-18.4,16,"304,188","386,448",1.7,"2,314,343"`,
    `46,5,"75,000","52,248",-6.1,3,"50,000","42,431",-5.0,17,"304,188","403,518",1.9,"2,400,000"`,
  ].join('\n')

  it('parses numbered blocks, carries the provider, skips unnumbered + totals', () => {
    const { policies, warnings } = parseInsuranceBulkCsv(parseCsv(csv), PROVIDERS)
    expect(policies.map((p) => p.policy_number)).toEqual(['2150202771', '28-9340140-4'])

    const chubb = policies[0]!
    expect(chubb).toMatchObject({
      provider: 'chubb',
      policy_name: 'Forever Diamond',
      start_date: '2015-10-07',
      currency: 'USD', // CHUBB default
      first_year: 45,
    })
    expect(chubb.points).toHaveLength(2)
    expect(chubb.points[0]).toEqual({
      age: 45,
      policy_year: 4,
      total_premium_paid: 60000,
      cash_value: 37276,
    })

    const manulife = policies[1]!
    expect(manulife).toMatchObject({ provider: 'manulife', currency: 'HKD' })

    expect(warnings.join(' ')).toMatch(/Elapsed Policy/) // skipped, no number
  })

  it('honours a per-provider currency override (incl. CNY)', () => {
    expect(
      parseInsuranceBulkCsv(parseCsv(csv), PROVIDERS, { chubb: 'HKD' }).policies[0]
        ?.currency,
    ).toBe('HKD')
    expect(
      parseInsuranceBulkCsv(parseCsv(csv), PROVIDERS, { chubb: 'CNY' }).policies[0]
        ?.currency,
    ).toBe('CNY')
  })

  it('only emits points with both premium and cash present', () => {
    const sparse = [
      `,CHUBB,,,`,
      `,P,,,`,
      `,"123: Jan 1, 2020",,,`,
      `Age,Policy Year,Total Premium Paid,Cash Value,Surrender Gain %/Yr`,
      `45,4,"60,000","37,276",-9.5`,
      `46,5,,,`, // blank premium/cash → no point
    ].join('\n')
    const { policies } = parseInsuranceBulkCsv(parseCsv(sparse), PROVIDERS)
    expect(policies[0]?.points).toHaveLength(1)
  })
})

describe('parseInsuranceSingleCsv', () => {
  const csv = [
    'Provider,CHUBB',
    'Policy Number,2150202771',
    'Policy Name,Forever Diamond (FDR05)',
    '"Start Date","Oct 7, 2015"',
    'Age,Policy Year,Total Premium Paid,Cash Value,Surrender Gain %/Yr',
    '45,4,"60,000","37,276",-9.5',
    '46,5,"75,000","52,248",-6.1',
    '47,6,,,', // blank → not a point
  ].join('\n')

  it('parses the key/value header + data table (ignoring surrender gain)', () => {
    const { policy, errors } = parseInsuranceSingleCsv(parseCsv(csv), PROVIDERS)
    expect(errors).toEqual([])
    expect(policy).toMatchObject({
      provider: 'chubb',
      policy_number: '2150202771',
      policy_name: 'Forever Diamond (FDR05)',
      start_date: '2015-10-07',
      first_year: 45,
    })
    expect(policy?.points).toHaveLength(2)
  })

  it('errors when the policy number or table is missing', () => {
    expect(
      parseInsuranceSingleCsv(parseCsv('Provider,CHUBB'), PROVIDERS).errors[0],
    ).toMatch(/table header/i)
    const noNum = [
      'Provider,CHUBB',
      'Age,Policy Year,Total Premium Paid,Cash Value',
      '45,4,1,2',
    ].join('\n')
    expect(parseInsuranceSingleCsv(parseCsv(noNum), PROVIDERS).errors.join(' ')).toMatch(
      /Policy Number/,
    )
  })
})
