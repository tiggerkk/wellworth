import { SheetLoader } from '../components/SheetLoader'
import { ConfigListEditor } from '../components/ConfigListEditor'
import { ColorPicker } from '../components/ColorPicker'
import { useAuth } from '../auth/AuthProvider'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { countQuotesByField, reassignQuoteField } from '../data/quote'
import { bumpQuotes } from '../lib/quotes-refresh'
import { QUOTE_CATEGORY_COLORS } from '../constants/quotes'
import {
  addCategory,
  categoryColor,
  effectiveCategories,
  removeCategory,
  renameCategory,
  reorderCategories,
} from '../lib/quotes-config'

/**
 * Quotes → Categories (M8): add / rename / delete / reorder the owner's Category list, stored on
 * `profile.quote_categories`. Category is required on every quote, so the last value can't be deleted;
 * deleting an in-use value reassigns its quotes first.
 */
export function QuoteCategoriesSheet() {
  const { session } = useAuth()
  const { profile, loading, save } = useProfileEditor()

  return (
    <SheetLoader
      label="Categories"
      title="Categories"
      loading={loading}
      data={profile}
      errorText="Couldn’t load categories."
    >
      {(prof) => {
        const list = effectiveCategories(prof.quote_categories)
        return (
          <ConfigListEditor
            list={list}
            noun="category"
            itemNoun="quote"
            userId={session?.user.id}
            persist={(next) => void save({ quote_categories: next })}
            add={addCategory}
            rename={renameCategory}
            remove={removeCategory}
            reorder={reorderCategories}
            count={(key) => countQuotesByField(session!.user.id, 'category', key)}
            reassign={(from, to) =>
              reassignQuoteField(session!.user.id, 'category', from, to)
            }
            onChanged={bumpQuotes}
            rowExtra={(entry, update) => (
              <ColorPicker
                value={entry.color ?? categoryColor(list, entry.key)}
                onChange={(color) => update({ color })}
                options={QUOTE_CATEGORY_COLORS}
                ariaLabel={`Colour for ${entry.label}`}
              />
            )}
          />
        )
      }}
    </SheetLoader>
  )
}
