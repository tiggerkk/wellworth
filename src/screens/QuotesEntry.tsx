import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {
  IconClipboard,
  IconHeart,
  IconHeartFilled,
  IconLink,
  IconX,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { createQuote, getQuote, listDistinctTags, updateQuote } from '../data/quote'
import {
  detectLanguage,
  isFieldVisible,
  type LinkCandidate,
  type QuoteRow,
} from '../lib/quotes'
import { bumpQuotes } from '../lib/quotes-refresh'
import {
  QUOTE_CATEGORIES,
  QUOTE_CATEGORY_LABELS,
  QUOTE_LANGUAGE_LABELS,
  QUOTE_LANGUAGES,
  QUOTE_SOURCE_TYPE_LABELS,
  QUOTE_SOURCE_TYPES,
  type QuoteCategory,
  type QuoteLanguage,
  type QuoteSourceType,
} from '../constants/quotes'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { TagInput } from '../components/TagInput'
import { QuoteSourceLinkSheet } from '../components/QuoteSourceLinkSheet'

interface QuoteDraft {
  text: string
  author: string
  source_type: QuoteSourceType
  title: string
  category: QuoteCategory | ''
  tags: string[]
  language: QuoteLanguage
  is_favorite: boolean
  // Cross-module link — carried through as loaded; the M3 linker sets these.
  show_id: string | null
  book_id: string | null
}

function blankDraft(prefill: {
  text: string
  author: string
  title: string
}): QuoteDraft {
  return {
    text: prefill.text,
    author: prefill.author,
    source_type: 'tv',
    title: prefill.title,
    category: '',
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
    author: row.author ?? '',
    source_type: row.source_type as QuoteSourceType,
    title: row.title ?? '',
    category: row.category as QuoteCategory,
    tags: row.tags ?? [],
    language: row.language as QuoteLanguage,
    is_favorite: row.is_favorite,
    show_id: row.show_id,
    book_id: row.book_id,
  }
}

/**
 * Quotes — Add / Edit (M2: manual). Outer loader + inner form keyed by id (so a stale `useAsync`
 * result never mounts under the wrong quote). A new quote can be prefilled from `?text=&author=
 * &title=` (copy-paste / an Apple Books Shortcut). The Show/Book linker arrives in M3.
 */
export function QuotesEntry() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const text = params.get('text') ?? ''
  const author = params.get('author') ?? ''
  const title = params.get('title') ?? ''

  const loadFn = useCallback(async (): Promise<QuoteDraft | null> => {
    if (!id) return blankDraft({ text, author, title })
    const row = await getQuote(id)
    return row ? draftFromRow(row) : null
  }, [id, text, author, title])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {(error || (!loading && !initial)) && (
        <p className="p-4 text-sm text-danger">Couldn’t load this quote.</p>
      )}
      {!loading && initial && <QuoteForm key={id ?? 'new'} id={id} initial={initial} />}
    </div>
  )
}

const inputClass =
  'w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none'

const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard

function QuoteForm({ id, initial }: { id: string | undefined; initial: QuoteDraft }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  // Entry field visibility (Quotes Settings). Quote Text / Category / heart / buttons are always shown.
  const show = (key: string) => isFieldVisible(profile?.quote_visible_fields ?? null, key)

  const tagsFn = useCallback(
    async () => (userId ? listDistinctTags(userId) : []),
    [userId],
  )
  const { data: tagSuggestions } = useAsync(tagsFn)

  const [draft, setDraft] = useState<QuoteDraft>(initial)
  const [saving, setSaving] = useState(false)
  // Language is auto-detected from the text until the user touches the control (or we're editing
  // an existing quote, whose stored language must not be overwritten by retyping).
  const [languageTouched, setLanguageTouched] = useState(!!id)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  const update = (patch: Partial<QuoteDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const canSave = !!draft.text.trim() && draft.category !== ''
  const linked = !!draft.show_id || !!draft.book_id

  // Linking a local Show/Book binds its FK and denormalises Title + Source Type onto the quote (a
  // book also fills Author; a show leaves Author for the speaker/character — owner decision). The
  // fields stay editable, and Unlink keeps the filled values (only clears the FK).
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
        category: draft.category as QuoteCategory,
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

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Close"
          className="text-text-secondary"
        >
          <IconX size={22} />
        </button>
        <h1 className="flex-1 truncate text-[17px] font-medium text-text-primary">
          {id ? 'Edit Quote' : 'Add Quote'}
        </h1>
        <button
          onClick={() => update({ is_favorite: !draft.is_favorite })}
          aria-label="Favourite"
        >
          {draft.is_favorite ? (
            <IconHeartFilled size={20} className="text-accent" />
          ) : (
            <IconHeart size={20} className="text-text-tertiary" />
          )}
        </button>
        <SecondaryButton
          size="sm"
          onClick={() => setDraft(initial)}
          disabled={!dirty || saving}
        >
          RESET
        </SecondaryButton>
        <PrimaryButton
          size="sm"
          onClick={() => void save()}
          disabled={saving || !canSave || (!!id && !dirty)}
        >
          {saving ? 'Saving…' : id ? 'SAVE' : 'CREATE'}
        </PrimaryButton>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Quote</span>
            {canPaste && (
              <button
                onClick={() => void pasteFromClipboard()}
                className="flex items-center gap-1 text-xs text-accent"
              >
                <IconClipboard size={14} /> Paste
              </button>
            )}
          </div>
          <textarea
            value={draft.text}
            onChange={(e) => changeText(e.target.value)}
            rows={4}
            placeholder="The quote itself…"
            className={`mt-1 ${inputClass} resize-none placeholder:text-text-tertiary`}
          />
        </div>

        {show('author') && (
          <label className="text-xs text-text-secondary">
            Author
            <input
              value={draft.author}
              onChange={(e) => update({ author: e.target.value })}
              placeholder="Who said or wrote it"
              className={`mt-1 ${inputClass} placeholder:text-text-tertiary`}
            />
          </label>
        )}

        {show('source_link') && (
          <div>
            <p className="mb-1 text-xs text-text-secondary">Source link</p>
            {linked ? (
              <div className="flex items-center gap-2 rounded-input bg-input px-3 py-2">
                <IconLink size={16} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate text-[15px] text-text-primary">
                  {draft.title || 'Linked source'}
                  <span className="text-text-secondary">
                    {' · '}
                    {QUOTE_SOURCE_TYPE_LABELS[draft.source_type]}
                  </span>
                </span>
                <button
                  onClick={unlink}
                  aria-label="Unlink source"
                  className="shrink-0 p-1 text-text-tertiary"
                >
                  <IconX size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLinkOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-input bg-input py-2 text-sm text-accent"
              >
                <IconLink size={16} /> Link a Show or Book
              </button>
            )}
          </div>
        )}

        {show('source_type') && (
          <div>
            <p className="mb-1 text-xs text-text-secondary">Source Type</p>
            <SelectMenu
              value={draft.source_type}
              options={QUOTE_SOURCE_TYPES.map((s) => ({
                value: s,
                label: QUOTE_SOURCE_TYPE_LABELS[s],
              }))}
              onChange={(s) => update({ source_type: s as QuoteSourceType })}
              ariaLabel="Source type"
            />
          </div>
        )}

        {show('title') && (
          <label className="text-xs text-text-secondary">
            Title
            <input
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Show, film, book, podcast…"
              className={`mt-1 ${inputClass} placeholder:text-text-tertiary`}
            />
          </label>
        )}

        <div>
          <p className="mb-1 text-xs text-text-secondary">Category</p>
          <SelectMenu
            value={draft.category}
            options={[
              { value: '', label: 'Select category…' },
              ...QUOTE_CATEGORIES.map((c) => ({
                value: c,
                label: QUOTE_CATEGORY_LABELS[c],
              })),
            ]}
            onChange={(c) => update({ category: c as QuoteCategory | '' })}
            ariaLabel="Category"
          />
        </div>

        {show('tags') && (
          <div>
            <p className="mb-1 text-xs text-text-secondary">Tags</p>
            <TagInput
              value={draft.tags}
              onChange={(tags) => update({ tags })}
              suggestions={tagSuggestions ?? []}
            />
          </div>
        )}

        {show('language') && (
          <div>
            <p className="mb-1 text-xs text-text-secondary">Language</p>
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

        {saveError && <p className="text-sm text-danger">{saveError}</p>}
      </div>

      {linkOpen && (
        <QuoteSourceLinkSheet onSelect={selectLink} onClose={() => setLinkOpen(false)} />
      )}
    </>
  )
}
