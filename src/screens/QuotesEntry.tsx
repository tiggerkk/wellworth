import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { IconClipboard, IconLink, IconX } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useEntryFavorite } from '../hooks/useEntryFavorite'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useDirty } from '../hooks/useDirty'
import { EntryLoader } from '../components/EntryLoader'
import { EntryHeaderTitle } from '../components/EntryHeaderTitle'
import { FIELD_CLASS as inputClass } from '../constants/forms'
import {
  createQuote,
  deleteQuote,
  getQuote,
  listDistinctTags,
  updateQuote,
} from '../data/quote'
import {
  detectLanguage,
  isFieldVisible,
  type LinkCandidate,
  type QuoteRow,
} from '../lib/quotes'
import {
  effectiveCategories,
  effectiveSourceTypes,
  sourceTypeLabel,
  type QuoteCategoryConfig,
  type QuoteSourceTypeConfig,
} from '../lib/quotes-config'
import { bumpQuotes } from '../lib/quotes-refresh'
import {
  QUOTE_LANGUAGE_LABELS,
  QUOTE_LANGUAGES,
  type QuoteLanguage,
} from '../constants/quotes'
import type { Tables } from '../types/database'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { TagInput } from '../components/TagInput'
import { QuoteSourceLinkOverlay } from '../components/QuoteSourceLinkOverlay'

interface QuoteDraft {
  text: string
  // source_type / category hold configurable keys (see quotes-config.ts), so they're plain strings.
  source_type: string
  author: string
  title: string
  category: string
  tags: string[]
  language: QuoteLanguage
  is_favorite: boolean
  // Cross-module link — carried through as loaded; the M3 linker sets these.
  show_id: string | null
  book_id: string | null
}

function blankDraft(
  prefill: { text: string; author: string; title: string },
  sourceTypes: QuoteSourceTypeConfig[],
  categories: QuoteCategoryConfig[],
): QuoteDraft {
  return {
    text: prefill.text,
    // Default both dropdowns to their first configured value (Source Type and Category alike).
    source_type: sourceTypes[0]?.key ?? '',
    author: prefill.author,
    title: prefill.title,
    category: categories[0]?.key ?? '',
    tags: [],
    language: detectLanguage(prefill.text),
    is_favorite: false,
    show_id: null,
    book_id: null,
  }
}

function draftFromRow(row: QuoteRow): QuoteDraft {
  return {
    text: row.text,
    source_type: row.source_type,
    author: row.author ?? '',
    title: row.title ?? '',
    category: row.category,
    tags: row.tags ?? [],
    language: row.language as QuoteLanguage,
    is_favorite: row.is_favorite,
    show_id: row.show_id,
    book_id: row.book_id,
  }
}

/**
 * Quotes — Add / Edit (manual). Outer loader fetches the quote (edit) + the owner's profile (for the
 * configurable Source Type / Category lists + field visibility), then mounts the inner form keyed by id
 * so a stale `useAsync` result never mounts under the wrong quote. A new quote can be prefilled from
 * `?text=&author=&title=`. The Show/Book linker is `QuoteSourceLinkOverlay`.
 */
export function QuotesEntry() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const text = params.get('text') ?? ''
  const author = params.get('author') ?? ''
  const title = params.get('title') ?? ''

  const { data: profile, loading: profileLoading } = useProfile()
  const loadFn = useCallback(
    async (): Promise<QuoteRow | null> => (id ? getQuote(id) : null),
    [id],
  )
  const { data: row, loading: rowLoading, error } = useAsync(loadFn)

  const sourceTypes = useMemo(
    () => effectiveSourceTypes(profile?.quote_source_types ?? null),
    [profile],
  )
  const categories = useMemo(
    () => effectiveCategories(profile?.quote_categories ?? null),
    [profile],
  )

  const initial = useMemo<QuoteDraft | null>(() => {
    if (id) return row ? draftFromRow(row) : null
    return blankDraft({ text, author, title }, sourceTypes, categories)
  }, [id, row, text, author, title, sourceTypes, categories])

  const loading = profileLoading || rowLoading

  useEscapeKey(() => navigate(-1))

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* 
        Outer structural header remains statically mounted during data retrieval,
        rendering "Loading" elegantly under a unified layout frame.
      */}
      <EntryHeaderTitle
        title={id ? 'Edit Quote' : 'New Quote'}
        actions={<div className="w-24 shrink-0" />}
      />

      <EntryLoader
        loading={loading}
        error={error}
        data={initial}
        errorText="Couldn’t load this quote."
      >
        {(d) => (
          <QuoteForm
            key={id ?? 'new'}
            id={id}
            initial={d}
            profile={profile ?? null}
            sourceTypes={sourceTypes}
            categories={categories}
          />
        )}
      </EntryLoader>
    </div>
  )
}

const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard

function QuoteForm({
  id,
  initial: initialProp,
  profile,
  sourceTypes,
  categories,
}: {
  id: string | undefined
  initial: QuoteDraft
  profile: Tables<'profile'> | null
  sourceTypes: QuoteSourceTypeConfig[]
  categories: QuoteCategoryConfig[]
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  // Entry field visibility (Quotes Settings). Quote Text / Category / heart / buttons are always shown.
  const show = (key: string) => isFieldVisible(profile?.quote_visible_fields ?? null, key)

  const tagsFn = useCallback(
    async () => (userId ? listDistinctTags(userId) : []),
    [userId],
  )
  const { data: tagSuggestions } = useAsync(tagsFn)

  // `initial` is stateful (not just the loader's prop) so an immediate favorite save (see
  // `useEntryFavorite`) can sync the dirty baseline without affecting any other in-progress edits.
  const [initial, setInitial] = useState<QuoteDraft>(initialProp)
  const [draft, setDraft] = useState<QuoteDraft>(initialProp)
  const [saving, setSaving] = useState(false)
  // Language is auto-detected from the text until the user touches the control (or we're editing
  // an existing quote, whose stored language must not be overwritten by retyping).
  const [languageTouched, setLanguageTouched] = useState(!!id)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  const update = (patch: Partial<QuoteDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = useDirty(draft, initial)
  // Category now defaults to the first value, so it's always set — only the text is required.
  const canSave = !!draft.text.trim()
  const linked = !!draft.show_id || !!draft.book_id

  // Linking a local Show/Book binds its FK and denormalises Title + Source Type onto the quote (a
  // book also fills Author; a show leaves Author for the speaker/character — owner decision). The
  // candidate's sourceType is always one of the protected keys (tv/movie/book), so it stays valid.
  function selectLink(c: LinkCandidate) {
    if (c.kind === 'show') {
      update({
        show_id: c.id,
        book_id: null,
        source_type: c.sourceType,
        title: c.title,
      })
    } else {
      update({
        book_id: c.id,
        show_id: null,
        source_type: 'book',
        title: c.title,
        author: c.authors.join(', ') || draft.author,
      })
    }
    setLinkOpen(false)
  }

  function unlink() {
    update({ show_id: null, book_id: null })
  }

  function changeText(next: string) {
    setDraft((d) => ({
      ...d,
      text: next,
      language: languageTouched ? d.language : detectLanguage(next),
    }))
  }

  function changeLanguage(next: QuoteLanguage) {
    setLanguageTouched(true)
    update({ language: next })
  }

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) changeText(t)
    } catch {
      // Clipboard read denied/unavailable — silently no-op (the field stays editable).
    }
  }

  async function save() {
    if (!userId || !canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      const row = {
        text: draft.text.trim(),
        author: draft.author.trim() || null,
        source_type: draft.source_type,
        title: draft.title.trim() || null,
        category: draft.category,
        tags: draft.tags,
        language: draft.language,
        is_favorite: draft.is_favorite,
        show_id: draft.show_id,
        book_id: draft.book_id,
      }
      if (id) await updateQuote(id, row)
      else await createQuote({ ...row, user_id: userId })
      bumpQuotes()
      navigate(-1)
    } catch (e) {
      // UNIQUE(user_id, text_norm) → "no exact duplicates" (the manual-entry counterpart to the
      // importer's ON CONFLICT DO NOTHING).
      const code = (e as { code?: string }).code
      setSaveError(
        code === '23505'
          ? 'You already have this quote.'
          : 'Couldn’t save — please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!id) return
    setSaving(true)
    try {
      await deleteQuote(id)
      bumpQuotes()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  const toggleFavorite = useEntryFavorite({
    id,
    favorite: draft.is_favorite,
    setFavorite: (next) => update({ is_favorite: next }),
    syncInitialFavorite: (next) => setInitial((i) => ({ ...i, is_favorite: next })),
    persist: (quoteId, next) => updateQuote(quoteId, { is_favorite: next }),
    bump: bumpQuotes,
  })

  return (
    <>
      {/* 
        Anchors functional header interface exactly over the pre-allocated top layout bracket.
        Absolute alignment coordinates prevent breaking context boxes across compact resolutions.
      */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-3">
        <EntryHeaderActions
          editing={!!id}
          dirty={dirty}
          saving={saving}
          canSubmit={canSave}
          onReset={() => setDraft(initial)}
          onSubmit={() => void save()}
          onDelete={id ? () => void remove() : undefined}
          favorite={draft.is_favorite}
          onToggleFavorite={toggleFavorite}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-secondary">Quote</span>
            {canPaste && (
              <button
                onClick={() => void pasteFromClipboard()}
                className="flex items-center gap-1 text-caption text-accent"
              >
                <IconClipboard size={14} /> Paste
              </button>
            )}
          </div>
          <textarea
            value={draft.text}
            onChange={(e) => changeText(e.target.value)}
            rows={6}
            placeholder="The quote itself…"
            className={`mt-1 ${inputClass} resize-none`}
          />
        </div>

        {(show('title') || show('source_link')) && (
          <div className="flex items-end gap-2">
            {show('title') && (
              <label className="flex-1 text-caption text-text-secondary">
                Title
                <input
                  value={draft.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="Show, film, book, podcast…"
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            )}
            {show('source_link') &&
              (linked ? (
                <button
                  onClick={unlink}
                  aria-label="Unlink source"
                  title={`Linked · ${sourceTypeLabel(sourceTypes, draft.source_type)}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-input bg-input px-3 py-2 text-field text-accent"
                >
                  <IconLink size={16} /> Linked <IconX size={14} />
                </button>
              ) : (
                <button
                  onClick={() => setLinkOpen(true)}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-input bg-input px-3 py-2 text-field text-accent"
                >
                  <IconLink size={16} /> Show or Book
                </button>
              ))}
          </div>
        )}

        {(show('author') || show('source_type')) && (
          <div className="flex gap-3">
            {show('author') && (
              <label className="flex-1 text-caption text-text-secondary">
                Author
                <input
                  value={draft.author}
                  onChange={(e) => update({ author: e.target.value })}
                  placeholder="Who said or wrote it"
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            )}
            {show('source_type') && (
              <div className="w-32">
                <p className="mb-1 text-caption text-text-secondary">Source Type</p>
                <SelectMenu
                  value={draft.source_type}
                  options={sourceTypes.map((s) => ({ value: s.key, label: s.label }))}
                  onChange={(s) => update({ source_type: s })}
                  ariaLabel="Source type"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <div className="w-40">
            <p className="mb-1 text-caption text-text-secondary">Category</p>
            <SelectMenu
              value={draft.category}
              options={categories.map((c) => ({ value: c.key, label: c.label }))}
              onChange={(c) => update({ category: c })}
              ariaLabel="Category"
            />
          </div>
          {show('language') && (
            <div className="flex-1">
              <p className="mb-1 text-caption text-text-secondary">Language</p>
              <SegmentedTabs
                value={draft.language}
                onChange={changeLanguage}
                options={QUOTE_LANGUAGES.map((l) => ({
                  value: l,
                  label: QUOTE_LANGUAGE_LABELS[l],
                }))}
              />
            </div>
          )}
        </div>

        {show('tags') && (
          <div>
            <p className="mb-1 text-caption text-text-secondary">Tags</p>
            <TagInput
              value={draft.tags}
              onChange={(tags) => update({ tags })}
              suggestions={tagSuggestions ?? []}
            />
          </div>
        )}

        {saveError && <p className="text-body text-danger">{saveError}</p>}
      </div>

      {linkOpen && (
        <QuoteSourceLinkOverlay
          initialQuery={draft.title}
          onSelect={selectLink}
          onClose={() => setLinkOpen(false)}
        />
      )}
    </>
  )
}
