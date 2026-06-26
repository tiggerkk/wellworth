import { describe, expect, it } from 'vitest'
import { searchZhVariants, zhQueryVariants } from './zh-query'

describe('zhQueryVariants', () => {
  it('returns [] for an empty query', async () => {
    expect(await zhQueryVariants('   ')).toEqual([])
  })

  it('returns just the trimmed query for non-CJK (no opencc load)', async () => {
    expect(await zhQueryVariants('  Matrix ')).toEqual(['Matrix'])
  })

  it('expands a Traditional query to include its Simplified fold', async () => {
    const variants = await zhQueryVariants('紅樓夢')
    expect(variants).toContain('紅樓夢') // original
    expect(variants).toContain('红楼梦') // Simplified fold
  })

  it('expands a Simplified query to include an HK-Traditional form', async () => {
    const variants = await zhQueryVariants('红楼梦')
    expect(variants).toContain('红楼梦') // original
    expect(variants.some((v) => v !== '红楼梦')).toBe(true) // a Traditional form too
  })
})

describe('searchZhVariants', () => {
  it('runs a single request for a non-CJK query', async () => {
    const calls: string[] = []
    const run = async (q: string) => {
      calls.push(q)
      return [{ k: q }]
    }
    const out = await searchZhVariants('matrix', run, (i) => i.k)
    expect(calls).toEqual(['matrix'])
    expect(out).toEqual([{ k: 'matrix' }])
  })

  it('merges + de-dupes results across variants, earlier variant first', async () => {
    const calls: string[] = []
    const run = async (q: string) => {
      calls.push(q)
      // every variant returns a shared item plus a per-variant unique one
      return [{ k: 'shared' }, { k: q }]
    }
    const out = await searchZhVariants('紅', run, (i) => i.k)
    expect(calls.length).toBeGreaterThan(1) // fired in both scripts
    expect(out[0]).toEqual({ k: 'shared' }) // shared kept once, from the first variant
    expect(out.filter((i) => i.k === 'shared')).toHaveLength(1)
    // the per-variant items are all present
    for (const q of calls) expect(out).toContainEqual({ k: q })
  })

  it('tolerates one failing variant when another succeeds', async () => {
    const run = async (q: string) => {
      if (q === '红') return [{ k: 'ok' }]
      throw new Error('boom')
    }
    const out = await searchZhVariants('紅', run, (i) => i.k)
    expect(out).toEqual([{ k: 'ok' }])
  })

  it('rethrows when every variant fails', async () => {
    const run = async () => {
      throw new Error('all-down')
    }
    await expect(
      searchZhVariants('紅樓夢', run, (i: { k: string }) => i.k),
    ).rejects.toThrow('all-down')
  })
})
