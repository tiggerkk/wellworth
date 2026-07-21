/**
 * Standardized 2-line insurance policy header — reused everywhere a policy's identity is shown:
 * Monthly Entry insurance rows, Insurance Policies rows, Policy Detail, Compare Schedules, and
 * Import Policy Schedule. Presentational only; each caller supplies its own wrapping element
 * (button row, modal body div, etc.) and text sizing is fixed here so the two are always visually
 * identical no matter where they render.
 *
 * Line 1: Policy Number · Start Date
 * Line 2 (secondary): Provider · Policy Name
 */
import { formatFullDate } from '../lib/date'

export function InsurancePolicyHeader({
  policyNumber,
  startDate,
  providerLabel,
  policyName,
  truncate = false,
}: {
  policyNumber: string
  startDate: string | null
  providerLabel: string
  policyName: string
  /** Monthly Entry / Insurance Policies rows sit in a fixed-width row and truncate; modal
   *  headers (Policy Detail, Compare Schedules, Import Policy Schedule) have room to wrap. */
  truncate?: boolean
}) {
  const lineClass = truncate ? 'block truncate' : 'block'
  return (
    <>
      <span className={`${lineClass} text-body text-text-primary`}>
        {policyNumber}
        {startDate ? ` · ${formatFullDate(startDate)}` : ''} · {providerLabel}
      </span>
      <span className={`${lineClass} text-caption text-text-secondary`}>
        {policyName}
      </span>
    </>
  )
}
