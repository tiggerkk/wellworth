import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('handles quoted fields with commas and quotes', () => {
    expect(parseCsv('name,note\n"Yogurt, Greek","2"" cup"')).toEqual([
      ['name', 'note'],
      ['Yogurt, Greek', '2" cup'],
    ])
  })

  it('handles newlines inside quoted fields', () => {
    expect(parseCsv('a\n"line1\nline2",b')).toEqual([['a'], ['line1\nline2', 'b']])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('strips a leading BOM', () => {
    expect(parseCsv('﻿name\nx')).toEqual([['name'], ['x']])
  })

  it('does not add a trailing empty row for a final newline', () => {
    expect(parseCsv('a\nb\n')).toEqual([['a'], ['b']])
  })

  it('keeps a blank middle line as a single empty cell', () => {
    expect(parseCsv('a\n\nb')).toEqual([['a'], [''], ['b']])
  })

  it('preserves trailing empty fields', () => {
    expect(parseCsv('a,b,c\n1,,')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', ''],
    ])
  })
})

describe('toCsv', () => {
  it('serializes simple rows unquoted', () => {
    expect(
      toCsv([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ]),
    ).toBe('a,b,c\r\n1,2,3')
  })

  it('quotes a field containing a comma', () => {
    expect(toCsv([['Yogurt, Greek']])).toBe('"Yogurt, Greek"')
  })

  it('quotes a field containing a double-quote, doubling it', () => {
    expect(toCsv([['2" cup']])).toBe('"2"" cup"')
  })

  it('quotes a field containing a newline', () => {
    expect(toCsv([['line1\nline2']])).toBe('"line1\nline2"')
  })

  it('leaves an empty cell unquoted', () => {
    expect(toCsv([['a', '', 'c']])).toBe('a,,c')
  })

  it('round-trips through parseCsv', () => {
    const rows = [
      ['name', 'note'],
      ['Yogurt, Greek', '2" cup'],
      ['Plain', ''],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})
