import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { ConfigListEditor } from '../components/ConfigListEditor'
import { SelectMenu } from '../components/SelectMenu'
import { useAuth } from '../auth/AuthProvider'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { countPoliciesByProvider, reassignProvider } from '../data/insurance'
import { bumpNetWorth } from '../lib/networth-refresh'
import { CURRENCIES, type Currency } from '../lib/networth'
import {
  addProvider,
  effectiveProviders,
  removeProvider,
  renameProvider,
  reorderProviders,
  type InsuranceProviderConfig,
} from '../lib/insurance-config'

const CCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }))

/**
 * Net Worth → Manage Providers: add / rename / delete / reorder the owner's insurance-provider list,
 * stored on `profile.insurance_providers` (the Quotes pattern). Each row also edits the provider's
 * **default import currency** (the per-row control). A provider is required on every policy, so the
 * last value can't be deleted; deleting an in-use value reassigns its policies to a chosen value first.
 */
export function InsuranceProvidersSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { profile, loading, save } = useProfileEditor()
  const userId = session?.user.id

  return (
    <Sheet variant="full" label="Insurance Providers">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Insurance Providers</h1>
      </header>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {profile && (
        <ConfigListEditor<InsuranceProviderConfig>
          list={effectiveProviders(profile.insurance_providers)}
          noun="provider"
          itemNoun="policy"
          userId={userId}
          persist={(next) => void save({ insurance_providers: next })}
          add={addProvider}
          rename={renameProvider}
          remove={removeProvider}
          reorder={reorderProviders}
          count={(key) => countPoliciesByProvider(userId!, key)}
          reassign={(from, to) => reassignProvider(userId!, from, to)}
          onChanged={bumpNetWorth}
          hint={(e) => `imports as ${e.defaultCurrency}`}
          rowExtra={(entry, update) => (
            <div className="w-24">
              <SelectMenu
                value={entry.defaultCurrency}
                options={CCY_OPTIONS}
                onChange={(v) => update({ defaultCurrency: v as Currency })}
                ariaLabel={`Default currency for ${entry.label}`}
              />
            </div>
          )}
        />
      )}
    </Sheet>
  )
}
