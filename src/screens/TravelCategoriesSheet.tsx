import { SheetLoader } from '../components/SheetLoader'
import { ConfigListEditor } from '../components/ConfigListEditor'
import { ColorPicker } from '../components/ColorPicker'
import { useAuth } from '../auth/AuthProvider'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { countExpensesByCategory, reassignExpenseCategory } from '../data/travel'
import { bumpTravel } from '../lib/travel-refresh'
import { TRAVEL_CATEGORY_COLORS } from '../constants/travel'
import {
  addCategory,
  categoryColor,
  effectiveCategories,
  removeCategory,
  renameCategory,
  reorderCategories,
} from '../lib/travel-config'

/**
 * Travel → Expense Categories: add / rename / delete / reorder the owner's category list, stored on
 * `profile.travel_expense_categories`. Category is required on every expense, so the last value can't
 * be deleted; deleting an in-use value reassigns its expenses to a chosen value first.
 */
export function TravelCategoriesSheet() {
  const { session } = useAuth()
  const { profile, loading, save } = useProfileEditor()
  const userId = session?.user.id

  return (
    <SheetLoader
      label="Expense Categories"
      title="Expense Categories"
      loading={loading}
      data={profile}
      errorText="Couldn’t load expense categories."
    >
      {(prof) => {
        const list = effectiveCategories(prof.travel_expense_categories)
        return (
          <ConfigListEditor
            list={list}
            noun="category"
            itemNoun="expense"
            userId={userId}
            persist={(next) => void save({ travel_expense_categories: next })}
            add={addCategory}
            rename={renameCategory}
            remove={removeCategory}
            reorder={reorderCategories}
            count={(key) => countExpensesByCategory(userId!, key)}
            reassign={(from, to) => reassignExpenseCategory(userId!, from, to)}
            onChanged={bumpTravel}
            rowExtra={(entry, update) => (
              <ColorPicker
                value={entry.color ?? categoryColor(list, entry.key)}
                onChange={(color) => update({ color })}
                options={TRAVEL_CATEGORY_COLORS}
                ariaLabel={`Colour for ${entry.label}`}
              />
            )}
          />
        )
      }}
    </SheetLoader>
  )
}
