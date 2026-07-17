import { useCallback } from 'react'
import { useParams } from 'react-router'
import { SheetLoader } from '../components/SheetLoader'
import { NetWorthFundDetail } from '../components/NetWorthFundDetail'
import { useAsync } from '../hooks/useAsync'
import { getAssetEntry } from '../data/asset-entry'

/** Routed Fund detail drill-in — loads a fund holding by its asset_entry id and shows its fields. */
export function NetWorthFundDetailSheet() {
  const { id = '' } = useParams()
  const loadFn = useCallback(() => getAssetEntry(id), [id])
  const { data: entry, loading, error } = useAsync(loadFn)

  return (
    <SheetLoader
      label="Fund detail"
      title={entry?.name ?? 'Fund'}
      titleClassName="line-clamp-2 flex-1 text-heading font-medium text-text-primary"
      loading={loading}
      error={error}
      data={entry}
      errorText="Couldn’t load this fund."
    >
      {(d) => (
        <div className="flex-1 overflow-y-auto p-4">
          <NetWorthFundDetail
            data={{
              name: d.name,
              valueHkd: Number(d.value_base),
              details: (d.details ?? {}) as Record<string, unknown>,
            }}
          />
        </div>
      )}
    </SheetLoader>
  )
}
