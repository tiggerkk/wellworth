import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconChevronLeft, IconChevronRight, IconClipboard } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useDirty } from '../hooks/useDirty'
import { useDiscardConfirm } from '../hooks/useDiscardConfirm'
import { EntryLoader } from '../components/EntryLoader'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Calendar, type DayCue } from '../components/Calendar'
import { TagInput } from '../components/TagInput'
import { LabelChip } from '../components/LabelChip'
import { FilterPill } from '../components/FilterPill'
import { FIELD_CLASS as inputClass } from '../constants/forms'
import { routes } from '../constants/routes'
import { useProfile } from '../hooks/useProfile'
import { JOURNAL_MOOD_DEFAULT_KEY } from '../constants/journal'
import { effectiveMoods, moodSubTags } from '../lib/journal-moods'
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  getJournalEntryByDay,
  listDistinctJournalTags,
  listJournalDays,
  updateJournalEntry,
} from '../data/journal'
import { bumpJournal } from '../lib/journal-refresh'
import type { JournalRow } from '../lib/journal'
import { addDays, formatDayLabel, todayLocal, type IsoDate } from '../lib/date'
import { showToast } from '../lib/toast'

interface JournalDraft {
  journal_entry: string
  mood: string
  tags: string[]
}

function blankJournalDraft(): JournalDraft {
  return { journal_entry: '', mood: JOURNAL_MOOD_DEFAULT_KEY, tags: [] }
}

function draftFromRow(row: JournalRow): JournalDraft {
  return { journal_entry: row.journal_entry, mood: row.mood, tags: row.tags ?? [] }
}

const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard

/**
 * Journal — Add / Edit. Unlike Quotes/Insurance (one fixed record per screen), Journal is
 * **day-based**: the calendar nav at the top of the body can switch which record is being edited
 * without leaving the screen (one entry per day, `unique(user_id, day)`). Because of that, this
 * screen intentionally does NOT use `useEntryDraft`/`useEntryClose` (both assume a single fixed
 * `id` for the screen's lifetime) — instead `JournalForm` re-resolves the record for the current
 * `day` itself (a race-safe effect, since `useAsync`'s "keep previous data while loading" behavior
 * would otherwise flash the previous day's text while the next day's fetch is in flight).
 *
 * Entry points: `/quotes/journal/entry` (blank, defaults to today) from "+ New Journal"/the bottom
 * nav, or `/quotes/journal/:id` (the day that record belongs to) from a Library row tap. Close and
 * Save always return to the Journal listing — day-browsing inside the screen means there's no
 * single "this record's" route to return to instead.
 */
export function JournalEntry() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Resolve the screen's starting day once: the routed record's day (edit) or today (new).
  const initialRowFn = useCallback(
    () => (id ? getJournalEntry(id) : Promise.resolve(null)),
    [id],
  )
  const { data: initialRow, loading, error } = useAsync(initialRowFn)
  const initialDay: IsoDate | null = id ? (initialRow?.day ?? null) : todayLocal()

  const [dirty, setDirty] = useState(false)
  // Whether the *currently viewed day* has a saved record — not the route's initial `id`. Both the
  // header icon (back vs close) and title need this, since in-screen day nav (chevrons/calendar)
  // can land on a day whose saved/blank status differs from where the screen was opened.
  const [hasEntry, setHasEntry] = useState(!!id)
  const goToListing = useCallback(
    () => navigate(routes.quotes.journalLibrary, { replace: true }),
    [navigate],
  )
  const { requestClose, confirm } = useDiscardConfirm(dirty, goToListing)
  useEscapeKey(requestClose)

  // Browser/tab close with unsaved changes (mirrors useEntryClose's guard).
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function afterSave(toastMessage: string) {
    showToast(toastMessage)
    goToListing()
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <ScreenHeaderTitle
        title="Journal Entry"
        icon={hasEntry ? 'back' : 'close'}
        onClose={requestClose}
        actions={<div className="w-24 shrink-0" />}
      />

      <EntryLoader
        loading={loading}
        error={error}
        data={initialDay}
        errorText="Couldn’t load this journal entry."
      >
        {(day) => (
          <JournalForm
            key={id ?? 'new'}
            startDay={day}
            initialRow={id ? (initialRow ?? null) : null}
            onDirtyChange={setDirty}
            onHasEntryChange={setHasEntry}
            afterSave={afterSave}
          />
        )}
      </EntryLoader>

      <ConfirmDialog
        open={confirm.open}
        title="Discard changes?"
        message="You have unsaved changes to this journal entry. Discard them?"
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </div>
  )
}

function JournalForm({
  startDay,
  initialRow,
  onDirtyChange,
  onHasEntryChange,
  afterSave,
}: {
  startDay: IsoDate
  // The row the OUTER screen already fetched via `getJournalEntry(id)` for the Edit entry point —
  // null for the New entry point (there's deliberately no by-day fetch yet: whether `startDay`
  // already has an entry is exactly what the effect below must still check, same as any other day).
  initialRow: JournalRow | null
  onDirtyChange: (dirty: boolean) => void
  onHasEntryChange: (hasEntry: boolean) => void
  afterSave: (toastMessage: string) => void
}) {
  const { session } = useAuth()
  const userId = session?.user.id

  const [day, setDay] = useState<IsoDate>(startDay)
  const seedDraft = initialRow ? draftFromRow(initialRow) : blankJournalDraft()
  const [entryId, setEntryId] = useState<string | null>(initialRow?.id ?? null)
  const [initial, setInitial] = useState<JournalDraft>(seedDraft)
  const [draft, setDraft] = useState<JournalDraft>(seedDraft)
  // Already resolved for `startDay` when we have an `initialRow` to seed from (Edit entry point);
  // otherwise the effect below still needs to run once to find out (New entry point).
  const [dayLoading, setDayLoading] = useState(!initialRow)
  const [calendarOpen, setCalendarOpen] = useState(false)
  // Set when a day-nav action (chevron/calendar) is blocked by unsaved changes; confirming applies
  // the switch, canceling stays put. Separate from the screen-level close guard (`JournalEntry`'s
  // `useDiscardConfirm`) — this one only gates *switching days*, not leaving the screen.
  const [pendingDay, setPendingDay] = useState<IsoDate | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const update = (patch: Partial<JournalDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = useDirty(draft, initial)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    onHasEntryChange(!!entryId)
  }, [entryId, onHasEntryChange])

  // Re-resolve the record for `day` whenever it changes. A request token guards against a race
  // where the user flips days quickly and an earlier fetch resolves after a later one.
  const reqRef = useRef(0)
  // `startDay` never changes for a given mount (the screen remounts via `key={id ?? 'new'}` on
  // entry-point change) — a plain (non-effect, non-ref) constant would be fine too, but a ref keeps
  // the intent explicit: "the day this form opened on", distinct from the current `day` state.
  const startDayRef = useRef(startDay)
  useEffect(() => {
    if (!userId) return
    // Skip the redundant round-trip for the Edit entry point's starting day only — the outer
    // screen already fetched this exact row via `getJournalEntry(id)` (see `initialRow` above).
    // Every subsequent day change (chevron/calendar), and the New entry point's `startDay`
    // (`initialRow` is always null there), still fetches normally.
    if (initialRow !== null && day === startDayRef.current) return
    const myReq = ++reqRef.current
    setDayLoading(true)
    getJournalEntryByDay(userId, day)
      .then((row) => {
        if (reqRef.current !== myReq) return // stale — a newer day fetch has since started
        const d = row ? draftFromRow(row) : blankJournalDraft()
        setEntryId(row?.id ?? null)
        setInitial(d)
        setDraft(d)
        setDayLoading(false)
      })
      .catch(() => {
        if (reqRef.current !== myReq) return
        setDayLoading(false)
      })
  }, [userId, day, initialRow])

  const tagsFn = useCallback(
    async () => (userId ? listDistinctJournalTags(userId) : []),
    [userId],
  )
  const { data: tagSuggestions } = useAsync(tagsFn)

  const { data: profile } = useProfile()
  const moods = useMemo(
    () => effectiveMoods(profile?.journal_moods),
    [profile?.journal_moods],
  )
  const subTags = useMemo(() => moodSubTags(moods, draft.mood), [moods, draft.mood])

  function toggleSuggestedTag(tag: string) {
    const exists = draft.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    update({
      tags: exists
        ? draft.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...draft.tags, tag],
    })
  }

  // Green cue dots for days with an entry (Wellness Diary's cue-dot pattern, single-cue: no
  // legend needed since there's only ever one kind of dot here).
  const loadCalendarCues = useCallback(
    async (monthStart: IsoDate, monthEnd: IsoDate): Promise<Map<IsoDate, DayCue>> => {
      const map = new Map<IsoDate, DayCue>()
      if (!userId) return map
      for (const d of await listJournalDays(userId, monthStart, monthEnd)) {
        map.set(d, { food: true })
      }
      return map
    },
    [userId],
  )

  function requestChangeDay(next: IsoDate) {
    if (next === day) return
    if (dirty) setPendingDay(next)
    else setDay(next)
  }

  const canSave = !!draft.journal_entry.trim()

  async function save() {
    if (!userId || !canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        journal_entry: draft.journal_entry.trim(),
        mood: draft.mood,
        tags: draft.tags,
      }
      if (entryId) {
        await updateJournalEntry(entryId, payload)
      } else {
        await createJournalEntry({ ...payload, day, user_id: userId })
      }
      bumpJournal()
      afterSave(entryId ? 'Journal entry saved' : 'Journal entry created')
    } catch {
      setSaveError('Couldn’t save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!entryId) return
    setSaving(true)
    try {
      await deleteJournalEntry(entryId)
      bumpJournal()
      afterSave('Journal entry deleted')
    } finally {
      setSaving(false)
    }
  }

  // Insert clipboard text at the cursor (replacing any selection) rather than overwriting the field.
  const taRef = useRef<HTMLTextAreaElement>(null)
  const pendingCaret = useRef<number | null>(null)
  useEffect(() => {
    const pos = pendingCaret.current
    if (pos == null || !taRef.current) return
    taRef.current.focus()
    taRef.current.setSelectionRange(pos, pos)
    pendingCaret.current = null
  }, [draft.journal_entry])

  async function pasteAtCursor() {
    const el = taRef.current
    if (!el) return
    const start = el.selectionStart ?? draft.journal_entry.length
    const end = el.selectionEnd ?? draft.journal_entry.length
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      pendingCaret.current = start + text.length
      update({
        journal_entry:
          draft.journal_entry.slice(0, start) + text + draft.journal_entry.slice(end),
      })
    } catch {
      // Clipboard read denied/unavailable — silently no-op (the field stays editable).
    }
  }

  return (
    <>
      <div className="absolute top-3 right-4 z-10 flex items-center gap-3">
        <EntryHeaderActions
          editing={!!entryId}
          dirty={dirty}
          saving={saving}
          canSubmit={canSave}
          onReset={() => setDraft(initial)}
          onSubmit={() => void save()}
          onDelete={entryId ? () => void remove() : undefined}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Day nav — centered "< Date >", tap the date to open the calendar picker. */}
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => requestChangeDay(addDays(day, -1))}
            aria-label="Previous day"
            className="p-1 text-text-secondary"
          >
            <IconChevronLeft size={22} />
          </button>
          <button
            onClick={() => setCalendarOpen(true)}
            className="min-w-28 text-center text-body font-medium text-text-primary"
          >
            {formatDayLabel(day)}
          </button>
          <button
            onClick={() => requestChangeDay(addDays(day, 1))}
            aria-label="Next day"
            className="p-1 text-text-secondary"
          >
            <IconChevronRight size={22} />
          </button>
        </div>

        {dayLoading ? (
          <p className="text-body text-text-secondary">Loading…</p>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-caption text-text-secondary">Journal Entry</span>
                {canPaste && (
                  <button
                    onClick={() => void pasteAtCursor()}
                    className="flex items-center gap-1 text-caption text-accent"
                  >
                    <IconClipboard size={14} /> Paste
                  </button>
                )}
              </div>
              <textarea
                ref={taRef}
                value={draft.journal_entry}
                onChange={(e) => update({ journal_entry: e.target.value })}
                rows={12}
                placeholder="What happened today…"
                className={`mt-1 ${inputClass} resize-none`}
              />
            </div>

            <div>
              <p className="mb-1 text-caption text-text-secondary">Mood</p>
              <div className="grid grid-cols-4 gap-2">
                {moods.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => update({ mood: m.key })}
                    aria-pressed={draft.mood === m.key}
                  >
                    <LabelChip
                      label={m.label}
                      color={m.color}
                      size="body"
                      className={`w-full justify-center ${
                        draft.mood === m.key ? 'ring-2 ring-text-primary' : 'opacity-50'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {subTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {subTags.map((tag) => (
                    <FilterPill
                      key={tag}
                      label={tag}
                      tone="neutral"
                      selected={draft.tags.some(
                        (t) => t.toLowerCase() === tag.toLowerCase(),
                      )}
                      onClick={() => toggleSuggestedTag(tag)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 text-caption text-text-secondary">Tags</p>
              <TagInput
                value={draft.tags}
                onChange={(tags) => update({ tags })}
                suggestions={tagSuggestions ?? []}
              />
            </div>

            {saveError && <p className="text-body text-danger">{saveError}</p>}
          </>
        )}
      </div>

      {calendarOpen && (
        <Calendar
          day={day}
          loadCues={loadCalendarCues}
          legend={false}
          onSelect={(d) => {
            setCalendarOpen(false)
            requestChangeDay(d)
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      <ConfirmDialog
        open={pendingDay != null}
        title="Discard changes?"
        message="You have unsaved changes to this journal entry. Discard them?"
        onConfirm={() => {
          if (pendingDay) setDay(pendingDay)
          setPendingDay(null)
        }}
        onCancel={() => setPendingDay(null)}
      />
    </>
  )
}
