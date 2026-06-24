import { useNavigate } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { ConfigListEditor } from '../components/ConfigListEditor'
import { useAuth } from '../auth/AuthProvider'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { countQuotesByField, reassignQuoteField } from '../data/quote'
import { bumpQuotes } from '../lib/quotes-refresh'
import {
  addSourceType,
  effectiveSourceTypes,
  isProtectedSourceKey,
  removeSourceType,
  renameSourceType,
  reorderSourceTypes,
} from '../lib/quotes-config'

/**
 * Quotes → Source Types (M8): add / rename / delete / reorder the owner's Source Type list, stored on
 * `profile.quote_source_types`. The Show/Book-linking sources (TV / Movie / Book) are protected from
 * deletion so cross-module linking keeps working; deleting an in-use value reassigns its quotes first.
 */
export function QuoteSourceTypesSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { profile, loading, save } = useProfileEditor()

  return (
    <Sheet variant="full" label="Source Types">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Source Types</h1>
      </header>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {profile && (
        <ConfigListEditor
          list={effectiveSourceTypes(profile.quote_source_types)}
          noun="source type"
          itemNoun="quote"
          userId={session?.user.id}
          persist={(next) => void save({ quote_source_types: next })}
          add={addSourceType}
          rename={renameSourceType}
          remove={removeSourceType}
          reorder={reorderSourceTypes}
          count={(key) => countQuotesByField(session!.user.id, 'source_type', key)}
          reassign={(from, to) =>
            reassignQuoteField(session!.user.id, 'source_type', from, to)
          }
          onChanged={bumpQuotes}
          isProtected={isProtectedSourceKey}
          hint={(e) =>
            e.linkKind === 'show'
              ? 'links to Shows'
              : e.linkKind === 'book'
                ? 'links to Books'
                : null
          }
        />
      )}
    </Sheet>
  )
}
