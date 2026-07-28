import { describe, expect, it } from 'vitest'
import { htmlToText, parseSectionedIntro } from './html-text'

describe('htmlToText', () => {
  it('returns empty string for null/undefined', () => {
    expect(htmlToText(null)).toBe('')
    expect(htmlToText(undefined)).toBe('')
  })

  it('returns plain text unchanged', () => {
    expect(htmlToText('A desert planet.')).toBe('A desert planet.')
  })

  it('converts <br> tags to newlines', () => {
    expect(htmlToText('Line one<br>Line two<br/>Line three')).toBe(
      'Line one\nLine two\nLine three',
    )
  })

  it('converts closing <p> and <div> tags to newlines', () => {
    expect(htmlToText('<p>First para</p><p>Second para</p>')).toBe(
      'First para\nSecond para',
    )
  })

  it('strips all other tags', () => {
    expect(htmlToText('<b>Bold</b> and <i>italic</i> text')).toBe('Bold and italic text')
  })

  it('normalizes non-breaking spaces', () => {
    expect(htmlToText('A\u00a0B')).toBe('A B')
  })

  it('collapses 3+ newlines into 2', () => {
    expect(htmlToText('A<br><br><br><br>B')).toBe('A\n\nB')
  })

  it('trims trailing whitespace before newlines and at ends', () => {
    expect(htmlToText('  <p>Padded</p>  ')).toBe('Padded')
  })

  it('leaves literal backslash-n sequences untouched (not real newlines)', () => {
    expect(htmlToText('Line one\\nLine two')).toBe('Line one\\nLine two')
  })

  it('handles real newline characters as ordinary whitespace', () => {
    expect(htmlToText('Line one\nLine two')).toBe('Line one\nLine two')
  })
})

describe('parseSectionedIntro', () => {
  it('returns null for plain prose', () => {
    expect(parseSectionedIntro('曹植（192－232），字子建。')).toBeNull()
  })

  it('returns null for null/undefined/empty', () => {
    expect(parseSectionedIntro(null)).toBeNull()
    expect(parseSectionedIntro(undefined)).toBeNull()
    expect(parseSectionedIntro('')).toBeNull()
  })

  it('returns null for empty object placeholder', () => {
    expect(parseSectionedIntro('{}')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseSectionedIntro('{"foo": "bar"')).toBeNull()
  })

  it('returns null for JSON arrays', () => {
    expect(parseSectionedIntro('["a", "b"]')).toBeNull()
  })

  it('returns null when values are not all strings', () => {
    expect(parseSectionedIntro('{"foo": "bar", "count": 3}')).toBeNull()
  })

  it('parses a single-section object', () => {
    expect(parseSectionedIntro('{"軼事典故":"七步成詩\\n　　內容"}')).toEqual([
      { heading: '軼事典故', body: '七步成詩\n　　內容' },
    ])
  })

  it('parses multiple sections preserving key order', () => {
    const result = parseSectionedIntro('{"一":"A","二":"B","三":"C"}')
    expect(result).toEqual([
      { heading: '一', body: 'A' },
      { heading: '二', body: 'B' },
      { heading: '三', body: 'C' },
    ])
  })

  it('cleans HTML/whitespace inside each section body', () => {
    const result = parseSectionedIntro('{"heading":"A<br>B\\n\\n\\nC"}')
    expect(result).toEqual([{ heading: 'heading', body: 'A\nB\n\nC' }])
  })
})
