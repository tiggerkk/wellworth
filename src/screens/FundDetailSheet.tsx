import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { FundDetail } from '../components/FundDetail'
import { useAsync } from '../hooks/useAsync'
import { getAssetEntry } from '../data/asset-entry'

/** Routed Fund detail drill-in — loads a fund holding by its asset_entry id and shows its fields. */
export function FundDetailSheet() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const loadFn = useCallback(() => getAssetEntry(id), [id])
  const { data: entry, loading, error } = useAsync(loadFn)

  return (
    <Sheet variant="full" label="Fund detail">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="line-clamp-2 flex-1 text-[17px] font-medium text-text-primary">
          {entry?.name ?? 'Fund'}
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-sm text-text-secondary">Loading…</p>}
        {(error || (!loading && !entry)) && (
          <p className="text-sm text-danger">Couldn’t load this fund.</p>
        )}
        {entry && (
          <FundDetail
            data={{
              name: entry.name,
              valueHkd: Number(entry.value_base),
              details: (entry.details ?? {}) as Record<string, unknown>,
            }}
          />
        )}
      </div>
    </Sheet>
  )
}
