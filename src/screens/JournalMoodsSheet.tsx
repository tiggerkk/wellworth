import { useState } from 'react'
import { SheetLoader } from '../components/SheetLoader'
import { Collapsible } from '../components/Collapsible'
import { ColorPicker } from '../components/ColorPicker'
import { TagInput } from '../components/TagInput'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { PALETTE_SWATCHES } from '../constants/palette'
import {
  effectiveMoods,
  recolorMood,
  renameMood,
  resubTagMood,
  type JournalMoodConfig,
} from '../lib/journal-moods'
import type { Json } from '../types/database'

/**
 * Quotes Settings -> Journal Values -> Moods (M-Journal): rename, recolor, and edit the sub-tag
 * suggestions for each of the 7 fixed Journal moods, stored on `profile.journal_moods`. Unlike
 * `QuoteCategoriesSheet`, there's no add/delete/reorder here — the 7 keys and their circumplex
 * display order are structural (see `JOURNAL_MOODS`), so this isn't built on `ConfigListEditor`.
 *
 * `expandedKeys`/`saving` live in THIS component, not inside the `SheetLoader` render prop: every
 * `save()` bumps the shared profile version tick, which makes `useProfileEditor`'s `loading` flip
 * briefly true again — and `EntryLoader` fully unmounts its render-prop output while `loading` is
 * true. Anything stored inside that subtree (e.g. each mood's expand/collapse state, if left as
 * `Collapsible`'s own internal uncontrolled state) would reset on every single edit. Keeping this
 * state up here, in a component instance that itself never unmounts, is what survives that.
 */
export function JournalMoodsSheet() {
  const { profile, loading, save } = useProfileEditor()
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  async function persist(next: JournalMoodConfig[]) {
    setSaving(true)
    try {
      await save({ journal_moods: next as unknown as Json })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetLoader
      label="Moods"
      title="Moods"
      loading={loading}
      data={profile}
      errorText="Couldn’t load moods."
    >
      {(prof) => {
        const list = effectiveMoods(prof.journal_moods)
        return (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <p className="px-1 text-caption text-text-secondary">
              {saving ? 'Saving…' : 'All changes saved'}
            </p>
            {list.map((mood) => (
              <MoodRow
                key={mood.key}
                mood={mood}
                open={expandedKeys.has(mood.key)}
                onOpenChange={(open) =>
                  setExpandedKeys((prev) => {
                    const next = new Set(prev)
                    if (open) next.add(mood.key)
                    else next.delete(mood.key)
                    return next
                  })
                }
                onRename={(label) => void persist(renameMood(list, mood.key, label))}
                onRecolor={(color) => void persist(recolorMood(list, mood.key, color))}
                onSubTagsChange={(subTags) =>
                  void persist(resubTagMood(list, mood.key, subTags))
                }
              />
            ))}
          </div>
        )
      }}
    </SheetLoader>
  )
}

function MoodRow({
  mood,
  open,
  onOpenChange,
  onRename,
  onRecolor,
  onSubTagsChange,
}: {
  mood: JournalMoodConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  onRename: (label: string) => void
  onRecolor: (color: string) => void
  onSubTagsChange: (subTags: string[]) => void
}) {
  const [label, setLabel] = useState(mood.label)

  function commitLabel() {
    const trimmed = label.trim()
    if (trimmed && trimmed !== mood.label) onRename(trimmed)
    else setLabel(mood.label)
  }

  return (
    <Collapsible
      title={mood.label}
      color={mood.color}
      open={open}
      onOpenChange={onOpenChange}
      actions={
        <ColorPicker
          value={mood.color}
          onChange={onRecolor}
          options={PALETTE_SWATCHES}
          ariaLabel={`Colour for ${mood.label}`}
        />
      }
    >
      <div className="flex flex-col gap-3 p-3">
        <div>
          <p className="mb-1 text-caption text-text-secondary">Name</p>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setLabel(mood.label)
            }}
            aria-label={`Rename ${mood.label}`}
            className="field-control w-full"
          />
        </div>
        <div>
          <p className="mb-1 text-caption text-text-secondary">Sub-tag suggestions</p>
          <TagInput
            value={mood.subTags}
            onChange={onSubTagsChange}
            placeholder="Add a sub-tag…"
          />
        </div>
      </div>
    </Collapsible>
  )
}
