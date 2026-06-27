import { describe, expect, it } from 'vitest'
import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('returns a genuine Error message', () => {
    expect(errorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('reads a rethrown Postgrest-shaped object (not an Error instance)', () => {
    const pgError = {
      message: 'null value in column "created_at" violates not-null constraint',
      details: 'Failing row contains (…)',
      hint: '',
      code: '23502',
    }
    expect(errorMessage(pgError, 'Import failed.')).toBe(
      'null value in column "created_at" violates not-null constraint [23502] Failing row contains (…)',
    )
  })

  it('prefers hint over details when both are present', () => {
    const pgError = {
      message: 'permission denied for table show',
      details: 'some detail',
      hint: 'Grant the required privileges with: GRANT INSERT ON public.show TO authenticated;',
      code: '42501',
    }
    expect(errorMessage(pgError, 'Import failed.')).toBe(
      'permission denied for table show [42501] Grant the required privileges with: GRANT INSERT ON public.show TO authenticated;',
    )
  })

  it('returns a thrown string as-is', () => {
    expect(errorMessage('plain failure', 'fallback')).toBe('plain failure')
  })

  it('falls back when nothing usable can be extracted', () => {
    expect(errorMessage(null, 'fallback')).toBe('fallback')
    expect(errorMessage(undefined, 'fallback')).toBe('fallback')
    expect(errorMessage({}, 'fallback')).toBe('fallback')
    expect(errorMessage('   ', 'fallback')).toBe('fallback')
  })
})
