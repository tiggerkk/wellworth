/**
 * Pure search / filter / sort for the Insurance Policies list (mirrors `lib/medical` list helpers).
 * Operates on the catalogue shape `{ policy, schedules }` so it stays free of any data-layer import.
 */
import { breakEven, type ScheduleVersion } from './networth'

export interface InsuranceListItem {
  policy: {
    id: string
    provider: string
    policy_number: string
    policy_name: string
    start_date: string | null
    surrendered_from_month: string | null
  }
  schedules: ScheduleVersion[]
}

export type InsuranceSortField = 'startDate' | 'policyNumber' | 'policyName' | 'provider'

export interface InsuranceCriteria {
  query: string
  provider: string // 'all' | provider key
  surrenderedOnly: boolean
  brokeEvenOnly: boolean
  startFrom: string | null
  startTo: string | null
  sortField: InsuranceSortField
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_INSURANCE_CRITERIA: InsuranceCriteria = {
  query: '',
  provider: 'all',
  surrenderedOnly: false,
  brokeEvenOnly: false,
  startFrom: null,
  startTo: null,
  sortField: 'startDate',
  sortDir: 'desc',
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function applyInsuranceView(
  items: InsuranceListItem[],
  c: InsuranceCriteria,
): InsuranceListItem[] {
  const q = c.query.trim().toLowerCase()
  const filtered = items.filter(({ policy, schedules }) => {
    if (q && !`${policy.policy_number} ${policy.policy_name}`.toLowerCase().includes(q))
      return false
    if (c.provider !== 'all' && policy.provider !== c.provider) return false
    if (c.surrenderedOnly && !policy.surrendered_from_month) return false
    if (c.brokeEvenOnly && breakEven(schedules) === null) return false
    if (c.startFrom && (policy.start_date ?? '') < c.startFrom) return false
    if (c.startTo && (policy.start_date ?? '') > c.startTo) return false
    return true
  })

  const dir = c.sortDir === 'asc' ? 1 : -1
  return filtered.sort((a, b) => {
    const pa = a.policy
    const pb = b.policy
    let r = 0
    switch (c.sortField) {
      case 'startDate':
        r = cmp(pa.start_date ?? '', pb.start_date ?? '')
        break
      case 'policyNumber':
        r = cmp(pa.policy_number, pb.policy_number)
        break
      case 'policyName':
        r = cmp(pa.policy_name.toLowerCase(), pb.policy_name.toLowerCase())
        break
      case 'provider':
        r = cmp(pa.provider, pb.provider)
        break
    }
    return r * dir
  })
}
