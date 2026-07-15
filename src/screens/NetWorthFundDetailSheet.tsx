import { useCallback } from 'react'
import { useParams } from 'react-router'
import { EntryLoader } from '../components/EntryLoader'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { NetWorthFundDetail } from '../components/NetWorthFundDetail'
import { useAsync } from '../hooks/useAsync'
import { getAssetEntry } from '../data/asset-entry'

/** Routed Fund detail drill-in — loads a fund holding by its asset_entry id and shows its fields. */
export function NetWorthFundDetailSheet() {
  const { id = '' } = useParams()
  const loadFn = useCallback(() => getAssetEntry(id), [id])
  const { data: entry, loading, error } = useAsync(loadFn)

  return (
    <Sheet variant="full" label="Fund detail">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="line-clamp-2 flex-1 text-heading font-medium text-text-primary">
          {entry?.name ?? 'Fund'}
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <EntryLoader
          loading={loading}
          error={error}
          data={entry}
          errorText="Couldn’t load this fund."
        >
          {(d) => (
            <NetWorthFundDetail
              data={{
                name: d.name,
                valueHkd: Number(d.value_base),
                details: (d.details ?? {}) as Record<string, unknown>,
              }}
            />
          )}
        </EntryLoader>
      </div>
    </Sheet>
  )
}
