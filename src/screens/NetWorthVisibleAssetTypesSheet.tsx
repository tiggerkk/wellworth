import { useState } from 'react'
import { SheetLoader } from '../components/SheetLoader'
import { Toggle } from '../components/Toggle'
import { ReorderList } from '../components/ReorderList'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { ASSET_TYPE_LABELS, type AssetType } from '../constants/networth'
import { orderedAssetTypes, visibleAssetTypes } from '../lib/networth'
import { showToast } from '../lib/toast'
import type { Tables, TablesUpdate } from '../types/database'

/**
 * Net Worth Settings → Display → Visible Asset Types: a combined reorder + visibility list. Drag to
 * reorder, toggle to show/hide on Monthly Entry Dashboard. Saved to `networth_asset_type_order` /
 * `networth_visible_asset_types`. At least one type must stay visible.
 */
export function NetWorthVisibleAssetTypesSheet() {
  const { profile, loading, save } = useProfileEditor()

  return (
    <SheetLoader
      label="Visible asset types"
      title="Visible Asset Types"
      loading={loading}
      data={profile}
      errorText="Couldn’t load settings."
    >
      {(prof) => <Editor profile={prof} save={save} />}
    </SheetLoader>
  )
}

function Editor({
  profile,
  save,
}: {
  profile: Tables<'profile'>
  save: (patch: TablesUpdate<'profile'>) => Promise<void>
}) {
  const [order, setOrder] = useState<AssetType[]>(() =>
    orderedAssetTypes(profile.networth_asset_type_order),
  )
  const [visible, setVisible] = useState<AssetType[]>(() =>
    visibleAssetTypes(
      profile.networth_asset_type_order,
      profile.networth_visible_asset_types,
    ),
  )

  function reorder(next: string[]) {
    const typed = next as AssetType[]
    setOrder(typed)
    void save({ networth_asset_type_order: typed })
  }

  function toggle(key: AssetType, on: boolean) {
    const next = on ? [...visible, key] : visible.filter((k) => k !== key)
    if (next.length === 0) {
      showToast('At least one asset type must stay visible')
      return
    }
    setVisible(next)
    void save({ networth_visible_asset_types: next, networth_asset_type_order: order })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-2 px-1 text-caption text-text-secondary">
        Choose which asset types appear on Monthly Entry and the Dashboard, and drag the
        grip to reorder them.
      </p>
      <ReorderList
        ids={order}
        onReorder={reorder}
        renderLabel={(k) => ASSET_TYPE_LABELS[k as AssetType]}
        handleLabel={(k) => `Reorder ${ASSET_TYPE_LABELS[k as AssetType]}`}
        renderTrailing={(k) => (
          <Toggle
            checked={visible.includes(k as AssetType)}
            onChange={(on) => toggle(k as AssetType, on)}
            label={ASSET_TYPE_LABELS[k as AssetType]}
          />
        )}
      />
    </div>
  )
}
