/**
 * Standardized 2-line insurance policy header — reused everywhere a policy's identity is shown:
 * Monthly Entry insurance rows, Insurance Policies rows, Policy Detail, Compare Schedules, and
 * Import Policy Schedule. Presentational only; each caller supplies its own wrapping element
 * (button row, modal body div, etc.) and text sizing is fixed here so the two are always visually
 * identical no matter where they render.
 *
 * Line 1: Policy Number · Start Date
 * Line 2 (secondary): status chips (Surrendered / Matured / Past Break-Even) · Policy Name
 */
import { formatFullDate } from '../lib/date'
import { StatusChip } from './StatusChip'

export function InsurancePolicyHeader({
  policyNumber,
  startDate,
  providerLabel,
  policyName,
  terminationKind = null,
  brokeEven = false,
  truncate = false,
}: {
  policyNumber: string
  startDate: string | null
  providerLabel: string
  policyName: string
  /** Drives the Surrendered/Matured chip. Omitted entirely by callers that don't track it. */
  terminationKind?: 'surrendered' | 'matured' | null
  /** Drives the Past Break-Even chip; suppressed whenever terminationKind is set. */
  brokeEven?: boolean
  /** Monthly Entry / Insurance Policies rows sit in a fixed-width row and truncate; modal
   *  headers (Policy Detail, Compare Schedules, Import Policy Schedule) have room to wrap. */
  truncate?: boolean
}) {
  const lineClass = truncate ? 'block truncate' : 'block'
  const showBrokeEven = brokeEven && !terminationKind
  const hasChips = terminationKind != null || showBrokeEven
  return (
    <>
      <span className={`${lineClass} text-body text-text-primary`}>
        {policyNumber}
        {startDate ? ` · ${formatFullDate(startDate)}` : ''} · {providerLabel}
      </span>
      <span className={`${lineClass} text-caption text-text-secondary`}>
        {hasChips && (
          <span className="mr-1.5 inline-flex items-center gap-1.5">
            {terminationKind === 'surrendered' && (
              <StatusChip label="Surrendered" className="bg-track text-text-secondary" />
            )}
            {terminationKind === 'matured' && (
              <StatusChip label="Matured" className="bg-accent text-bg" />
            )}
            {showBrokeEven && (
              <StatusChip label="Past Break-Even" className="bg-positive text-bg" />
            )}
          </span>
        )}
        {policyName}
      </span>
    </>
  )
}
