import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

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
