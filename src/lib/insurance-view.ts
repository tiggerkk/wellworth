/**
 * Pure search / filter / sort for the Insurance Policies list (mirrors `lib/medical` list helpers).
 * Operates on the catalogue shape `{ policy, schedules }` so it stays free of any data-layer import.
 */
import { hasBrokenEven, type ScheduleVersion } from './networth'

export interface InsuranceListItem {
  policy: {
    id: string
    provider: string
    policy_number: string
    policy_name: string
    notes: string | null
    start_date: string | null
    termination_kind: string | null // null | 'surrendered' | 'matured'
  }
  schedules: ScheduleVersion[]
}

export type InsuranceSortField = 'startDate' | 'policyNumber' | 'policyName' | 'provider'

/** Status filter: all policies, or only matured / only surrendered. */
export type InsuranceStatusFilter = 'all' | 'matured' | 'surrendered'

export interface InsuranceCriteria {
  query: string
  provider: string // 'all' | provider key
  status: InsuranceStatusFilter
  brokeEvenOnly: boolean
  startFrom: string | null
  startTo: string | null
  sortField: InsuranceSortField
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_INSURANCE_CRITERIA: InsuranceCriteria = {
  query: '',
  provider: 'all',
  status: 'all',
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
  /** Current insurance age — break-even is "past" only relative to it. */
  currentAge: number,
): InsuranceListItem[] {
  const q = c.query.trim().toLowerCase()
  const filtered = items.filter(({ policy, schedules }) => {
    if (
      q &&
      !`${policy.policy_number} ${policy.policy_name} ${policy.notes ?? ''}`
        .toLowerCase()
        .includes(q)
    )
      return false
    if (c.provider !== 'all' && policy.provider !== c.provider) return false
    if (c.status !== 'all' && policy.termination_kind !== c.status) return false
    if (c.brokeEvenOnly && !hasBrokenEven(schedules, currentAge)) return false
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
