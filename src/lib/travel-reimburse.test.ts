import { describe, expect, it } from 'vitest'
import { evalReimbursement } from './travel-reimburse'

describe('evalReimbursement', () => {
  it('evaluates amount expressions', () => {
    expect(evalReimbursement('amount/2', 100)).toBe(50)
    expect(evalReimbursement('amount/5*2', 100)).toBe(40)
    expect(evalReimbursement('amount', 100)).toBe(100)
    expect(evalReimbursement('(amount-50)/2', 150)).toBe(50)
    expect(evalReimbursement('amount*0.3', 100)).toBe(30)
  })
  it('evaluates a plain number', () => {
    expect(evalReimbursement('120', 100)).toBe(120)
    expect(evalReimbursement('80.5', 100)).toBe(80.5)
  })
  it('respects precedence and parentheses', () => {
    expect(evalReimbursement('2+3*4', 0)).toBe(14)
    expect(evalReimbursement('(2+3)*4', 0)).toBe(20)
  })
  it('rounds to cents', () => {
    expect(evalReimbursement('amount/3', 100)).toBe(33.33)
  })
  it('returns null on invalid input or non-finite results', () => {
    expect(evalReimbursement('', 100)).toBeNull()
    expect(evalReimbursement('amount/', 100)).toBeNull()
    expect(evalReimbursement('foo', 100)).toBeNull()
    expect(evalReimbursement('amount/0', 100)).toBeNull()
    expect(evalReimbursement('amount 2', 100)).toBeNull() // two operands, no operator
    expect(evalReimbursement('(amount', 100)).toBeNull()
  })
})
