/**
 * Reimbursement formula evaluation — a **safe mini-parser, never `eval`**. A formula is either a plain
 * number or a small arithmetic expression in the variable `amount` (the expense cost) using `+ - * / ( )`
 * and decimals, e.g. `amount/2`, `amount/5*2`, `120`, `(amount-50)/2`. Returns the computed number, or
 * null on a parse error or a non-finite result (e.g. divide-by-zero), so callers can show "invalid".
 *
 * Grammar (recursive descent, standard precedence):
 *   expr   = term (('+' | '-') term)*
 *   term   = factor (('*' | '/') factor)*
 *   factor = number | 'amount' | '(' expr ')' | '-' factor
 */

export const REIMBURSE_PRESETS: { label: string; formula: string }[] = [
  { label: '½', formula: 'amount/2' },
  { label: '⅖', formula: 'amount/5*2' },
  { label: 'Full', formula: 'amount' },
]

type Token =
  | { t: 'num'; v: number }
  | { t: 'amount' }
  | { t: 'op'; v: '+' | '-' | '*' | '/' }
  | { t: 'lp' }
  | { t: 'rp' }

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = []
  let i = 0
  const s = input.trim()
  while (i < s.length) {
    const c = s[i]!
    if (c === ' ') {
      i += 1
      continue
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ t: 'op', v: c })
      i += 1
    } else if (c === '(') {
      tokens.push({ t: 'lp' })
      i += 1
    } else if (c === ')') {
      tokens.push({ t: 'rp' })
      i += 1
    } else if (/[0-9.]/.test(c)) {
      let j = i + 1
      while (j < s.length && /[0-9.]/.test(s[j]!)) j += 1
      const num = Number(s.slice(i, j))
      if (!Number.isFinite(num)) return null
      tokens.push({ t: 'num', v: num })
      i = j
    } else if (s.slice(i, i + 6).toLowerCase() === 'amount') {
      tokens.push({ t: 'amount' })
      i += 6
    } else {
      return null // unknown character
    }
  }
  return tokens
}

export function evalReimbursement(formula: string, amount: number): number | null {
  if (!formula.trim()) return null
  const tokens = tokenize(formula)
  if (!tokens || tokens.length === 0) return null

  let pos = 0
  const peek = () => tokens[pos]
  let failed = false

  function parseExpr(): number {
    let left = parseTerm()
    for (;;) {
      const tk = peek()
      if (tk?.t === 'op' && (tk.v === '+' || tk.v === '-')) {
        pos += 1
        const right = parseTerm()
        left = tk.v === '+' ? left + right : left - right
      } else break
    }
    return left
  }

  function parseTerm(): number {
    let left = parseFactor()
    for (;;) {
      const tk = peek()
      if (tk?.t === 'op' && (tk.v === '*' || tk.v === '/')) {
        pos += 1
        const right = parseFactor()
        left = tk.v === '*' ? left * right : left / right
      } else break
    }
    return left
  }

  function parseFactor(): number {
    const tk = peek()
    if (!tk) {
      failed = true
      return 0
    }
    if (tk.t === 'op' && tk.v === '-') {
      pos += 1
      return -parseFactor()
    }
    if (tk.t === 'op' && tk.v === '+') {
      pos += 1
      return parseFactor()
    }
    if (tk.t === 'num') {
      pos += 1
      return tk.v
    }
    if (tk.t === 'amount') {
      pos += 1
      return amount
    }
    if (tk.t === 'lp') {
      pos += 1
      const v = parseExpr()
      if (peek()?.t !== 'rp') {
        failed = true
        return 0
      }
      pos += 1
      return v
    }
    failed = true
    return 0
  }

  const result = parseExpr()
  if (failed || pos !== tokens.length || !Number.isFinite(result)) return null
  // Round to cents to avoid floating-point dust.
  return Math.round(result * 100) / 100
}
