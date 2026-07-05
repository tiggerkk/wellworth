import { useState } from 'react'
import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { Toggle } from '../components/Toggle'
import { ReorderList } from '../components/ReorderList'
import { useProfileEditor } from '../hooks/useProfileEditor'
import {
  ASSET_TYPE_LABELS,
  orderedAssetTypes,
  visibleAssetTypes,
  type AssetType,
} from '../lib/networth'
import { showToast } from '../lib/toast'
import type { Tables, TablesUpdate } from '../types/database'

/**
 * Net Worth Settings → Display → Visible Asset Types: a combined reorder + visibility list. Drag to
 * reorder, toggle to show/hide on Monthly Entry Dashboard. Saved to `networth_asset_type_order` /
 * `networth_visible_asset_types`. At least one type must stay visible.
 */
export function NetWorthVisibleAssetTypesSheet() {
  const navigate = useNavigate()
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Visible asset types">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-heading font-medium text-text-primary">
          Visible Asset Types
        </h1>
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
