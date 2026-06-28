import { useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { IconPencil, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PolicyDetail } from '../components/PolicyDetail'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../hooks/useProfile'
import { getPolicyWithSchedules } from '../data/insurance'
import { ageForYear, DEFAULT_BIRTH_YEAR } from '../lib/networth'
import { todayLocal } from '../lib/date'
import { routes } from '../constants/routes'

/**
 * Routed Policy detail (read-only) — opened from a Monthly Entry insurance row or a dashboard
 * drill-in. Resolves the policy's figures at the month's age (defaults to the current year). An
 * Edit shortcut opens the New/Edit Insurance screen.
 */
export function PolicyDetailSheet() {
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

  return (
    <Sheet variant="full" label="Policy detail">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="line-clamp-2 flex-1 text-[17px] font-medium text-text-primary">
          {data?.policy.policy_name || 'Policy'}
        </h1>
        {data && (
          <button
            onClick={() => navigate(routes.networth.insuranceEdit(data.policy.id))}
            aria-label="Edit policy"
            className="shrink-0 text-text-secondary"
          >
            <IconPencil size={20} />
          </button>
        )}
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-sm text-text-secondary">Loading…</p>}
        {(error || (!loading && !data)) && (
          <p className="text-sm text-danger">Couldn’t load this policy.</p>
        )}
        {data && (
          <PolicyDetail policy={data.policy} schedules={data.schedules} age={age} />
        )}
      </div>
    </Sheet>
  )
}
