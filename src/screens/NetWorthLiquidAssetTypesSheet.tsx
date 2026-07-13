import { useState } from 'react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { Toggle } from '../components/Toggle'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetType } from '../constants/networth'
import { liquidAssetTypes } from '../lib/networth'
import type { Tables, TablesUpdate } from '../types/database'

/**
 * Net Worth Settings → Display → Liquid Assets: classify each asset type as liquid or non-liquid.
 * Drives the "Liquid Only" view toggle on the Dashboard + Monthly Entry, which excludes the
 * non-liquid types from the net-worth total. Saved to `networth_liquid_asset_types` (NULL = the code
 * defaults: cash, time deposit, stock, fund).
 */
export function NetWorthLiquidAssetTypesSheet() {
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Liquid assets">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">Liquid Assets</h1>
      </header>
      {loading && <p className="p-4 text-body text-text-secondary">Loading…</p>}
      {profile && <Editor profile={profile} save={save} />}
    </Sheet>
  )
}

function Editor({
  profile,
  save,
}: {
  profile: Tables<'profile'>
  save: (patch: TablesUpdate<'profile'>) => Promise<void>
}) {
  const [liquid, setLiquid] = useState<AssetType[]>(() =>
    liquidAssetTypes(profile.networth_liquid_asset_types),
  )

  function toggle(key: AssetType, on: boolean) {
    // Rebuild from ASSET_TYPES so the stored array stays in canonical order.
    const next = ASSET_TYPES.filter((t) => (t === key ? on : liquid.includes(t)))
    setLiquid(next)
    void save({ networth_liquid_asset_types: next })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-2 px-1 text-caption text-text-secondary">
        Mark which asset types count as liquid. The “Liquid Only” toggle on the Dashboard
        and Monthly Entry excludes the non-liquid types from your net-worth total.
      </p>
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {ASSET_TYPES.map((t) => (
          <div
            key={t}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <span className="flex-1 text-body text-text-primary">
              {ASSET_TYPE_LABELS[t]}
            </span>
            <Toggle
              checked={liquid.includes(t)}
              onChange={(on) => toggle(t, on)}
              label={ASSET_TYPE_LABELS[t]}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
