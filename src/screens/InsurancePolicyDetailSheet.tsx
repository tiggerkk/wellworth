import { useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { IconPencil } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { PrimaryButton } from '../components/PrimaryButton'
import { InsurancePolicyDetail } from '../components/InsurancePolicyDetail'
import { InsurancePolicyHeader } from '../components/InsurancePolicyHeader'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthProvider'
import { EntryLoader } from '../components/EntryLoader'
import { useProfile } from '../hooks/useProfile'
import { getPolicyWithSchedules } from '../data/insurance'
import { DEFAULT_BIRTH_YEAR } from '../constants/networth'
import { ageForYear } from '../lib/networth'
import { effectiveProviders, providerLabel } from '../lib/insurance-config'
import { todayLocal } from '../lib/date'
import { routes } from '../constants/routes'

/**
 * Routed Insurance Policy detail (read-only) — opened from a Monthly Entry insurance row or a dashboard
 * drill-in. Resolves the policy's figures at the month's age (defaults to the current year). An
 * Edit shortcut opens the New/Edit Insurance screen.
 */
export function InsurancePolicyDetailSheet() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()

  const loadFn = useCallback(
    () => (userId ? getPolicyWithSchedules(userId, id) : Promise.resolve(null)),
    [userId, id],
  )
  const { data, loading, error } = useAsync(loadFn)

  const month = params.get('month') ?? todayLocal()
  const year = Number(month.slice(0, 4))
  const birthYear = profile?.birthday
    ? Number(profile.birthday.slice(0, 4))
    : DEFAULT_BIRTH_YEAR
  const age = ageForYear(year, birthYear)
  const resolvedProviderLabel = data
    ? providerLabel(
        effectiveProviders(profile?.insurance_providers),
        data.policy.provider,
      )
    : ''

  return (
    <Sheet variant="full" label="Policy detail">
      {/* Header is always mounted (no shift once the policy loads) — the edit button is reserved
          space here, then absolutely floated over that same space by the loaded body below. */}
      <ScreenHeaderTitle icon="back" actions={<div className="w-5 shrink-0" />}>
        <div className="min-w-0 flex-1">
          {data ? (
            <InsurancePolicyHeader
              policyNumber={data.policy.policy_number}
              startDate={data.policy.start_date}
              providerLabel={resolvedProviderLabel}
              policyName={data.policy.policy_name}
              variant="header"
            />
          ) : (
            <p className="truncate text-title font-medium text-text-primary">
              Insurance Policy Detail
            </p>
          )}
        </div>
      </ScreenHeaderTitle>
      <EntryLoader
        loading={loading}
        error={error}
        data={data}
        errorText="Couldn’t load this policy."
      >
        {(d) => (
          <>
            <div className="absolute top-3 right-4 z-10">
              <PrimaryButton
                size="sm"
                onClick={() => navigate(routes.networth.insuranceEdit(d.policy.id))}
                aria-label="Edit policy"
              >
                <IconPencil size={18} />
              </PrimaryButton>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <InsurancePolicyDetail
                policy={d.policy}
                schedules={d.schedules}
                age={age}
              />
            </div>
          </>
        )}
      </EntryLoader>
    </Sheet>
  )
}
