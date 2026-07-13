import { useState } from 'react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { Toggle } from '../components/Toggle'
import { ReorderGrid } from '../components/ReorderGrid'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { MODULES } from '../constants/modules'
import { homeModules, orderedModuleKeys } from '../lib/modules-display'
import { showToast } from '../lib/toast'
import type { Tables, TablesUpdate } from '../types/database'

/**
 * Global Settings → DISPLAY → Visible Modules: a 2-up combined grid (`ReorderGrid`, following the
 * Home hub's 2-column layout) where each module cell has a visibility `Toggle` in its trailing slot —
 * drag the grip to reorder the hub, toggle to show/hide. A cell's grid position (left→right then
 * top→down) is its hub position. Saved per-profile to `module_order` /
 * `visible_modules` and consumed by the Home hub (`homeModules`). At least one module must stay visible
 * (same as `ConfigListEditor` refusing to delete the last value).
 */
export function VisibleModulesSheet() {
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Visible modules">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">Visible Modules</h1>
      </header>
      {loading && <p className="p-4 text-body text-text-secondary">Loading…</p>}
      {profile && <Editor profile={profile} save={save} />}
    </Sheet>
  )
}

const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  MODULES.map((m) => [m.key, m.label]),
)

function Editor({
  profile,
  save,
}: {
  profile: Tables<'profile'>
  save: (patch: TablesUpdate<'profile'>) => Promise<void>
}) {
  const [order, setOrder] = useState<string[]>(() =>
    orderedModuleKeys(profile.module_order),
  )
  // Seed from the same resolution the hub uses, so a not-yet-seen newly-shipped module reads as ON.
  const [visible, setVisible] = useState<string[]>(() =>
    homeModules(profile.module_order, profile.visible_modules).map((m) => m.key),
  )

  function reorder(next: string[]) {
    setOrder(next)
    void save({ module_order: next })
  }

  function toggle(key: string, on: boolean) {
    const next = on ? [...visible, key] : visible.filter((k) => k !== key)
    if (next.length === 0) {
      showToast('At least one module must stay visible')
      return
    }
    setVisible(next)
    // Persist `module_order` too: it's the seen-set `homeModules` uses to default newly-shipped
    // modules to visible, so it must be complete whenever `visible_modules` becomes non-null.
    void save({ visible_modules: next, module_order: order })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-2 px-1 text-caption text-text-secondary">
        Choose which modules appear on the Home hub, and drag the grip to reorder them.
        Cards fill the hub left→right then top to bottom.
      </p>
      <ReorderGrid
        ids={order}
        onReorder={reorder}
        renderLabel={(k) => MODULE_LABEL[k]}
        handleLabel={(k) => `Reorder ${MODULE_LABEL[k]}`}
        renderTrailing={(k) => (
          <Toggle
            checked={visible.includes(k)}
            onChange={(on) => toggle(k, on)}
            label={MODULE_LABEL[k]}
          />
        )}
      />
    </div>
  )
}
