import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { QuoteListEditor } from '../components/QuoteListEditor'
import { useAuth } from '../auth/AuthProvider'
import { useProfileEditor } from '../hooks/useProfileEditor'
import {
  addCategory,
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
  const navigate = useNavigate()
  const { session } = useAuth()
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Categories">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Categories</h1>
      </header>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {profile && (
        <QuoteListEditor
          list={effectiveCategories(profile.quote_categories)}
          field="category"
          noun="category"
          userId={session?.user.id}
          persist={(next) => void save({ quote_categories: next })}
          add={addCategory}
          rename={renameCategory}
          remove={removeCategory}
          reorder={reorderCategories}
        />
      )}
    </Sheet>
  )
}
