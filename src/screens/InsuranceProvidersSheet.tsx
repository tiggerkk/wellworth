import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { ConfigListEditor } from '../components/ConfigListEditor'
import { SelectMenu } from '../components/SelectMenu'
import { useAuth } from '../auth/AuthProvider'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { countPoliciesByProvider, reassignProvider } from '../data/insurance'
import { bumpNetWorth } from '../lib/networth-refresh'
import { NETWORTH_CURRENCIES, type NetworthCurrency } from '../constants/networth'
import {
  addProvider,
  effectiveProviders,
  removeProvider,
  renameProvider,
  reorderProviders,
  type InsuranceProviderConfig,
} from '../lib/insurance-config'

const CCY_OPTIONS = NETWORTH_CURRENCIES.map((c) => ({ value: c, label: c }))

/**
 * Net Worth → Manage Providers: add / rename / delete / reorder the owner's insurance-provider list,
 * stored on `profile.insurance_providers` (the Quotes pattern). Each row also edits the provider's
 * **default import currency** (the per-row control). A provider is required on every policy, so the
 * last value can't be deleted; deleting an in-use value reassigns its policies to a chosen value first.
 */
export function InsuranceProvidersSheet() {
  const { session } = useAuth()
  const { profile, loading, save } = useProfileEditor()
  const userId = session?.user.id

  return (
    <Sheet variant="full" label="Insurance Providers">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">
          Insurance Providers
        </h1>
      </header>
      {loading && <p className="p-4 text-body text-text-secondary">Loading…</p>}
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
                onChange={(v) => update({ defaultCurrency: v as NetworthCurrency })}
                ariaLabel={`Default currency for ${entry.label}`}
              />
            </div>
          )}
        />
      )}
    </Sheet>
  )
}
