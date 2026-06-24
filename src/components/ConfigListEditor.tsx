import { useState } from 'react'
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { ReorderList } from './ReorderList'
import { SelectMenu } from './SelectMenu'
import { PrimaryButton } from './PrimaryButton'
import { SecondaryButton } from './SecondaryButton'

interface ConfigListEditorProps<T extends { key: string; label: string }> {
  /** The current list (from the owner's profile config, NULL-tolerant). */
  list: T[]
  /** Singular noun for the value itself, e.g. "source type" / "category". */
  noun: string
  /** Singular noun for what references a value (gates deletion), e.g. "quote" / "expense". */
  itemNoun: string
  userId: string | undefined
  /** Persist the new list to the right profile column (auto-save). */
  persist: (next: T[]) => void
  add: (list: T[], label: string) => T[]
  rename: (list: T[], key: string, label: string) => T[]
  remove: (list: T[], key: string) => T[]
  reorder: (list: T[], keyOrder: string[]) => T[]
  /** How many rows currently reference `key` — gates its deletion. */
  count: (key: string) => Promise<number>
  /** Bulk-move referencing rows from one value to another before deleting. */
  reassign: (fromKey: string, toKey: string) => Promise<void>
  /** Called after a reassignment so dependent screens refresh. */
  onChanged?: () => void
  /** Keys that can't be deleted (rename/reorder stay allowed) — e.g. the Show/Book-linking sources. */
  isProtected?: (key: string) => boolean
  /** Optional sub-label shown under a row (e.g. "links to Shows"). */
  hint?: (entry: T) => string | null
}

/**
 * Reusable add / rename / delete / reorder editor for a configurable `{key,label}` list stored on the
 * profile (Quotes Source Types / Categories, Travel Expense Categories…). Reorder uses the shared
 * `ReorderList`; each row's trailing slot has rename + delete. Deleting a value still referenced by rows
 * opens a reassignment picker (rows are bulk-moved to the chosen value first); a protected or
 * last-remaining value can't be deleted. Every mutation auto-saves via `persist`. The data-layer
 * specifics (which table, how to count/reassign, what to refresh) are injected as `count` / `reassign` /
 * `onChanged`, so the editor is module-agnostic.
 */
export function ConfigListEditor<T extends { key: string; label: string }>({
  list,
  noun,
  itemNoun,
  userId,
  persist,
  add,
  rename,
  remove,
  reorder,
  count,
  reassign,
  onChanged,
  isProtected,
  hint,
}: ConfigListEditorProps<T>) {
  const [items, setItems] = useState<T[]>(list)
  const [newLabel, setNewLabel] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [reassignState, setReassignState] = useState<{
    key: string
    count: number
    to: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const labelFor = (key: string) => items.find((e) => e.key === key)?.label ?? key

  function apply(next: T[]) {
    setItems(next)
    persist(next)
  }

  function commitAdd() {
    const label = newLabel.trim()
    if (!label) return
    apply(add(items, label))
    setNewLabel('')
  }

  function commitEdit() {
    if (editingKey) {
      const label = editLabel.trim()
      if (label) apply(rename(items, editingKey, label))
    }
    setEditingKey(null)
    setEditLabel('')
  }

  async function requestDelete(key: string) {
    setError(null)
    if (items.length <= 1) {
      setError(`Keep at least one ${noun}.`)
      return
    }
    if (!userId) return
    setBusy(true)
    try {
      const used = await count(key)
      if (used === 0) {
        apply(remove(items, key))
      } else {
        const firstOther = items.find((e) => e.key !== key)!.key
        setReassignState({ key, count: used, to: firstOther })
      }
    } catch {
      setError('Couldn’t check usage — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmReassign() {
    if (!reassignState || !userId) return
    setBusy(true)
    setError(null)
    try {
      await reassign(reassignState.key, reassignState.to)
      apply(remove(items, reassignState.key))
      onChanged?.()
      setReassignState(null)
    } catch {
      setError('Couldn’t reassign — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <ReorderList
        ids={items.map((e) => e.key)}
        onReorder={(order) => apply(reorder(items, order))}
        handleLabel={(key) => `Reorder ${labelFor(key)}`}
        renderLabel={(key) =>
          editingKey === key ? (
            <input
              autoFocus
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') {
                  setEditingKey(null)
                  setEditLabel('')
                }
              }}
              aria-label={`Rename ${labelFor(key)}`}
              className="w-full rounded-input bg-input px-2 py-1 text-[15px] text-text-primary focus:outline-none"
            />
          ) : (
            <span className="flex items-baseline gap-2">
              <span className="truncate">{labelFor(key)}</span>
              {(() => {
                const h = hint?.(items.find((e) => e.key === key)!)
                return h ? <span className="text-xs text-text-tertiary">{h}</span> : null
              })()}
            </span>
          )
        }
        renderTrailing={(key) =>
          editingKey === key ? (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitEdit}
              aria-label="Save name"
              className="p-1 text-accent"
            >
              <IconCheck size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEditingKey(key)
                  setEditLabel(labelFor(key))
                }}
                aria-label={`Rename ${labelFor(key)}`}
                className="p-1 text-text-tertiary"
              >
                <IconPencil size={17} />
              </button>
              {!isProtected?.(key) && (
                <button
                  onClick={() => void requestDelete(key)}
                  disabled={busy}
                  aria-label={`Delete ${labelFor(key)}`}
                  className="p-1 text-text-tertiary disabled:opacity-40"
                >
                  <IconTrash size={17} />
                </button>
              )}
            </div>
          )
        }
      />

      <div className="flex items-center gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitAdd()
          }}
          placeholder={`Add a ${noun}…`}
          className="flex-1 rounded-input bg-input px-3 py-2 text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        <button
          onClick={commitAdd}
          disabled={!newLabel.trim()}
          className="flex items-center gap-1 rounded-input bg-input px-3 py-2 text-sm text-accent disabled:opacity-40"
        >
          <IconPlus size={16} /> Add
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {reassignState && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-medium text-text-primary">
                Reassign before deleting
              </h2>
              <button
                onClick={() => setReassignState(null)}
                aria-label="Cancel"
                className="p-1 text-text-secondary"
              >
                <IconX size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-text-secondary">
              {reassignState.count} {itemNoun}
              {reassignState.count === 1 ? '' : 's'} use{' '}
              <span className="text-text-primary">“{labelFor(reassignState.key)}”</span>.
              Move {reassignState.count === 1 ? 'it' : 'them'} to:
            </p>
            <SelectMenu
              value={reassignState.to}
              onChange={(to) => setReassignState((r) => (r ? { ...r, to } : r))}
              options={items
                .filter((e) => e.key !== reassignState.key)
                .map((e) => ({ value: e.key, label: e.label }))}
              ariaLabel="Reassign to"
            />
            <div className="mt-4 flex justify-end gap-2">
              <SecondaryButton
                size="sm"
                onClick={() => setReassignState(null)}
                disabled={busy}
              >
                CANCEL
              </SecondaryButton>
              <PrimaryButton
                size="sm"
                onClick={() => void confirmReassign()}
                disabled={busy}
              >
                {busy ? 'Moving…' : 'MOVE & DELETE'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
