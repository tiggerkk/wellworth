/**
 * Standardized 2-line insurance policy header — reused everywhere a policy's identity is shown:
 * Monthly Entry insurance rows, Insurance Policies rows, Policy Detail screen header, Compare
 * Schedules, and Import Policy Schedule. Presentational only; each caller supplies its own
 * wrapping element (button row, modal body div, screen header, etc.).
 *
 * Line 1: Policy Number · Start Date (text-body by default, text-title via `variant="header"`)
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
  variant = 'row',
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
  /** `'row'` (default) for list/dashboard rows and modal bodies (`text-body`); `'header'` for the
   *  Policy Detail screen header (`text-title font-medium`, matching other Entry/Detail titles). */
  variant?: 'row' | 'header'
}) {
  const lineClass = truncate ? 'block truncate' : 'block'
  const showBrokeEven = brokeEven && !terminationKind
  const hasChips = terminationKind != null || showBrokeEven
  const line1Class =
    variant === 'header'
      ? `${lineClass} text-title font-medium text-text-primary`
      : `${lineClass} text-body text-text-primary`
  return (
    <>
      <span className={line1Class}>
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
