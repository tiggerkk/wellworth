import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { ConfigListEditor } from '../components/ConfigListEditor'
import { useAuth } from '../auth/AuthProvider'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { countExpensesByCategory, reassignExpenseCategory } from '../data/travel'
import { bumpTravel } from '../lib/travel-refresh'
import {
  addCategory,
  effectiveCategories,
  removeCategory,
  renameCategory,
  reorderCategories,
} from '../lib/travel-config'

/**
 * Travel → Expense Categories: add / rename / delete / reorder the owner's category list, stored on
 * `profile.travel_expense_categories` (the Quotes pattern). Category is required on every expense, so the
 * last value can't be deleted; deleting an in-use value reassigns its expenses to a chosen value first.
 */
export function TravelCategoriesSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { profile, loading, save } = useProfileEditor()
  const userId = session?.user.id

  return (
    <Sheet variant="full" label="Expense Categories">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-heading font-medium text-text-primary">Expense Categories</h1>
      </header>
      {loading && <p className="p-4 text-body text-text-secondary">Loading…</p>}
      {profile && (
        <ConfigListEditor
          list={effectiveCategories(profile.travel_expense_categories)}
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
        />
      )}
    </Sheet>
  )
}
