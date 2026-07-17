import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconArrowsDiagonal, IconPlus, IconUpload, IconX } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useDirty } from '../hooks/useDirty'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useProfile } from '../hooks/useProfile'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { EntryLoader } from '../components/EntryLoader'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { FIELD_CLASS as inputClass } from '../constants/forms'
import { deleteReport, getReportWithResults, saveReport } from '../data/medical'
import { bumpMedical } from '../lib/medical-refresh'
import {
  blankReportDraft,
  blankResultDraft,
  draftToSaveInput,
  reportToDraft,
  type ReportDraft,
} from '../lib/medical-draft'
import {
  MEDICAL_CATEGORY_COLOR,
  MEDICAL_CATEGORY_LABELS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  type MedicalLabTestSeed,
  EYE_REFRACTION_KEYS,
} from '../constants/medical'
import {
  isMedicalFieldVisible,
  labTestByKey,
  orderResultsForDisplay,
  usesBodyPart,
} from '../lib/medical'
import { groupResultsByCategory } from '../lib/medical-order'
import { formatFullDate } from '../lib/date'
import { routes } from '../constants/routes'
import { Calendar } from '../components/Calendar'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { SecondaryButton } from '../components/SecondaryButton'
import { SelectMenu } from '../components/SelectMenu'
import { MedicalResultCard } from '../components/MedicalResultCard'
import { Collapsible } from '../components/Collapsible'
import { MedicalTestPickerOverlay } from '../components/MedicalTestPickerOverlay'
import { EyeRefractionFields } from '../components/EyeRefractionFields'
import { NotesEditorOverlay } from '../components/NotesEditorOverlay'

const EYE_KEY_SET = new Set(EYE_REFRACTION_KEYS)

/**
 * Add / Edit Medical Report — the report parent plus its result rows (the structured import is a
 * separate sheet, M3). The draft model + result-row editor are shared
 * with the import review screen (`src/lib/medical-draft.ts` + `MedicalResultCard`).
 */
export function MedicalEntry() {
  const { id } = useParams()
  const navigate = useNavigate()
  const openSheet = useSheetNavigate()
  const { data: profile } = useProfile()

  const loadFn = useCallback(async (): Promise<ReportDraft | null> => {
    if (!id) return blankReportDraft()
    const data = await getReportWithResults(id)
    return data ? reportToDraft(data.report, data.results) : null
  }, [id])
  const { data: initial, loading, error } = useAsync(loadFn)

  useEscapeKey(() => navigate(-1))

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* 
        Outer structural header remains statically mounted during data retrieval,
        rendering "Loading" elegantly under a unified structure.
      */}
      <ScreenHeaderTitle
        title={id ? 'Edit Report' : 'New Report'}
        actions={
          <>
            {!id && profile?.medical_importer_enabled && (
              <button
                onClick={() => openSheet(routes.medical.import)}
                className="flex shrink-0 items-center gap-1.5 pl-2 text-body text-accent"
              >
                <IconUpload size={16} /> Import JSON
              </button>
            )}
            {/* Reservation slot matching header actions width to guard absolute composition */}
            <div className="w-24 shrink-0" />
          </>
        }
      />
      <EntryLoader
        loading={loading}
        error={error}
        data={initial}
        errorText="Couldn’t load this report."
      >
        {(d) => <ReportForm key={id ?? 'new'} id={id} initial={d} />}
      </EntryLoader>
    </div>
  )
}

function ReportForm({ id, initial }: { id: string | undefined; initial: ReportDraft }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  const vis = (key: string) =>
    isMedicalFieldVisible(profile?.medical_visible_fields ?? null, key)

  const [draft, setDraft] = useState<ReportDraft>(initial)
  const [saving, setSaving] = useState(false)
  const [datePicker, setDatePicker] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [narrativeOpen, setNarrativeOpen] = useState(false)

  const update = (patch: Partial<ReportDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = useDirty(draft, initial)

  // Mirrors the read-only Report detail screen's header (Line 1: Date - Type · Body Part), so the
  // Narrative editor modal opens on a heading the person already recognizes from that screen.
  const narrativeHeaderTitle =
    `${formatFullDate(draft.report_date)} - ${REPORT_TYPE_LABELS[draft.report_type] ?? draft.report_type}` +
    (usesBodyPart(draft.report_type) && draft.body_part ? ` · ${draft.body_part}` : '')

  // Eye reports surface the six refraction values in a dedicated grid; hide those rows from the
  // generic results list so they aren't edited twice.
  const isEye = draft.report_type === 'eye'
  const filteredResults = isEye
    ? draft.results.filter((r) => !(r.test_key && EYE_KEY_SET.has(r.test_key)))
    : draft.results
  // Show the result cards in the owner's Display Order (sections + tests) — the same ordering as the
  // Dashboard and Report detail. Purely presentational (keyed by clientId); editing/removal is unaffected.
  const listResults = orderResultsForDisplay(
    filteredResults,
    profile?.medical_section_order,
    profile?.medical_test_order,
  )

  function updateResult(
    clientId: string,
    patch: Partial<ReportDraft['results'][number]>,
  ) {
    setDraft((d) => ({
      ...d,
      results: d.results.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)),
    }))
  }
  function removeResult(clientId: string) {
    setDraft((d) => ({ ...d, results: d.results.filter((r) => r.clientId !== clientId) }))
  }
  function addFromTest(test: MedicalLabTestSeed) {
    setPickerOpen(false)
    setDraft((d) => ({
      ...d,
      results: [
        ...d.results,
        blankResultDraft(
          test.key,
          test.display_name,
          test.category,
          test.default_unit ?? '',
        ),
      ],
    }))
  }
  function addCustom() {
    setPickerOpen(false)
    setDraft((d) => ({
      ...d,
      results: [...d.results, blankResultDraft(null, '', 'other', '')],
    }))
  }
  // Upsert a single eye-refraction value by its test key; an emptied cell removes the row.
  function setEyeValue(testKey: string, value: string) {
    setDraft((d) => {
      if (value.trim() === '') {
        return { ...d, results: d.results.filter((r) => r.test_key !== testKey) }
      }
      if (d.results.some((r) => r.test_key === testKey)) {
        return {
          ...d,
          results: d.results.map((r) =>
            r.test_key === testKey ? { ...r, value_num: value } : r,
          ),
        }
      }
      const seed = labTestByKey.get(testKey)
      const row = blankResultDraft(
        testKey,
        seed?.display_name ?? testKey,
        'eye',
        seed?.default_unit ?? 'D',
      )
      return { ...d, results: [...d.results, { ...row, value_num: value }] }
    })
  }

  function setUrl(i: number, value: string) {
    setDraft((d) => {
      // The UI always shows at least one (ghost) link row even when none are stored yet,
      // so typing into that row seeds the first entry.
      const urls = d.document_urls.length > 0 ? d.document_urls : ['']
      return { ...d, document_urls: urls.map((u, j) => (j === i ? value : u)) }
    })
  }
  const addUrl = () => update({ document_urls: [...draft.document_urls, ''] })
  const removeUrl = (i: number) =>
    update({ document_urls: draft.document_urls.filter((_, j) => j !== i) })

  async function save() {
    if (!userId) return
    setSaving(true)
    try {
      await saveReport(userId, draftToSaveInput(draft), id)
      bumpMedical()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!id) return
    setSaving(true)
    try {
      await deleteReport(id)
      bumpMedical()
      // Don't navigate(-1) — that returns to this report's now-deleted read-only detail ("Couldn’t
      // load this report"). Land on the Reports list instead.
      navigate(routes.medical.reports)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* 
        Anchors action interface exactly over the pre-allocated header width segment.
        Absolute layout configuration securely matches bounds without escaping responsive constraints.
      */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-3">
        <EntryHeaderActions
          editing={!!id}
          dirty={dirty}
          saving={saving}
          onReset={() => setDraft(initial)}
          onSubmit={() => void save()}
          onDelete={id ? () => void remove() : undefined}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="mb-1 text-caption text-text-secondary">Report Date</p>
            <button
              onClick={() => setDatePicker(true)}
              className={`text-left ${inputClass}`}
            >
              {formatFullDate(draft.report_date)}
            </button>
          </div>
          <div className="flex-1">
            <p className="mb-1 text-caption text-text-secondary">Type</p>
            <SelectMenu
              value={draft.report_type}
              onChange={(report_type) => update({ report_type })}
              ariaLabel="Report type"
              options={REPORT_TYPES.map((t) => ({
                value: t,
                label: REPORT_TYPE_LABELS[t],
              }))}
            />
          </div>
        </div>

        {vis('provider') && (
          <label className="text-caption text-text-secondary">
            Provider
            <input
              value={draft.provider}
              onChange={(e) => update({ provider: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        )}

        {usesBodyPart(draft.report_type) && vis('body_part') && (
          <label className="text-caption text-text-secondary">
            Body Part
            <input
              value={draft.body_part}
              onChange={(e) => update({ body_part: e.target.value })}
              placeholder="e.g. neck, breast, pelvis"
              className={`mt-1 ${inputClass}`}
            />
          </label>
        )}

        {vis('narrative') && (
          <div className="text-caption text-text-secondary">
            <div className="flex items-center justify-between">
              <span>Narrative</span>
              <button
                type="button"
                onClick={() => setNarrativeOpen(true)}
                aria-label="Expand narrative"
                className="text-accent"
              >
                <IconArrowsDiagonal size={16} />
              </button>
            </div>
            <textarea
              value={draft.narrative}
              onChange={(e) => update({ narrative: e.target.value })}
              rows={3}
              placeholder="MRI / imaging / eye findings, doctor's comments"
              className={`mt-1 ${inputClass} resize-none`}
            />
          </div>
        )}

        {vis('document_urls') && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-caption text-text-secondary">
                Document Links (Google Drive)
              </p>
              <SecondaryButton size="sm" onClick={addUrl}>
                <span className="inline-flex items-center gap-1 text-positive">
                  <IconPlus size={15} /> Add Link
                </span>
              </SecondaryButton>
            </div>
            <div className="flex flex-col gap-2">
              {/* Always show at least one (ghost) row so a link box is visible before "Add Link". */}
              {(draft.document_urls.length > 0 ? draft.document_urls : ['']).map(
                (u, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={u}
                      onChange={(e) => setUrl(i, e.target.value)}
                      placeholder="http://…"
                      className={inputClass}
                    />
                    {draft.document_urls.length > 0 && (
                      <button
                        onClick={() => removeUrl(i)}
                        aria-label="Remove link"
                        className="p-1 text-text-tertiary"
                      >
                        <IconX size={18} />
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {isEye && <EyeRefractionFields results={draft.results} onSet={setEyeValue} />}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-caption uppercase tracking-[0.08em] text-text-secondary">
              {isEye ? 'Other Results' : 'Results'}
            </p>
            <SecondaryButton size="sm" onClick={() => setPickerOpen(true)}>
              <span className="inline-flex items-center gap-1 text-positive">
                <IconPlus size={15} /> Add Result
              </span>
            </SecondaryButton>
          </div>
          {listResults.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-body text-text-tertiary">
              {isEye
                ? 'No other results. Tap “Add Result”.'
                : 'No results yet. Tap “Add Result”.'}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {groupResultsByCategory(listResults).map((g) => (
                <Collapsible
                  key={g.category}
                  title={MEDICAL_CATEGORY_LABELS[g.category]}
                  color={MEDICAL_CATEGORY_COLOR[g.category]}
                  titleCase="caption"
                  variant="bare"
                  defaultOpen
                >
                  {g.rows.map((r) => (
                    <MedicalResultCard
                      key={r.clientId}
                      row={r}
                      onChange={(patch) => updateResult(r.clientId, patch)}
                      onRemove={() => removeResult(r.clientId)}
                    />
                  ))}
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </div>

      {datePicker && (
        <Calendar
          day={draft.report_date}
          onSelect={(d) => {
            update({ report_date: d })
            setDatePicker(false)
          }}
          onClose={() => setDatePicker(false)}
        />
      )}

      {pickerOpen && (
        <MedicalTestPickerOverlay
          onSelect={addFromTest}
          onAddCustom={addCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {narrativeOpen && (
        <NotesEditorOverlay
          title={narrativeHeaderTitle}
          subtitle={draft.provider || null}
          fieldLabel="Narrative"
          value={draft.narrative}
          onSave={(next) => update({ narrative: next })}
          onClose={() => setNarrativeOpen(false)}
        />
      )}
    </>
  )
}
