import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconPlus, IconUpload, IconX } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useProfile } from '../hooks/useProfile'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { getReportWithResults, saveReport } from '../data/medical'
import { bumpMedical } from '../lib/medical-refresh'
import {
  blankReportDraft,
  blankResultDraft,
  draftToSaveInput,
  reportToDraft,
  type ReportDraft,
} from '../lib/medical-draft'
import {
  isMedicalFieldVisible,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  usesBodyPart,
  type MedicalLabTestSeed,
} from '../lib/medical'
import { formatDayLabel } from '../lib/date'
import { routes } from '../constants/routes'
import { Calendar } from '../components/Calendar'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { SelectMenu } from '../components/SelectMenu'
import { MedicalResultCard } from '../components/MedicalResultCard'
import { MedicalTestPickerSheet } from '../components/MedicalTestPickerSheet'

const inputClass =
  'w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none'

/**
 * Add / Edit Medical Report — the report parent plus its result rows (the structured import is a
 * separate sheet, M3). Mirrors `ShowsEntry`'s outer loader + inner form keyed by id, and the Net
 * Worth parent+children RESET/CREATE/SAVE pattern. The draft model + result-row editor are shared
 * with the import review screen (`src/lib/medical-draft.ts` + `MedicalResultCard`).
 */
export function MedicalEntry() {
  const { id } = useParams()
  const loadFn = useCallback(async (): Promise<ReportDraft | null> => {
    if (!id) return blankReportDraft()
    const data = await getReportWithResults(id)
    return data ? reportToDraft(data.report, data.results) : null
  }, [id])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {(error || (!loading && !initial)) && (
        <p className="p-4 text-sm text-danger">Couldn’t load this report.</p>
      )}
      {!loading && initial && <ReportForm key={id ?? 'new'} id={id} initial={initial} />}
    </div>
  )
}

function ReportForm({ id, initial }: { id: string | undefined; initial: ReportDraft }) {
  const navigate = useNavigate()
  const openSheet = useSheetNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  const vis = (key: string) =>
    isMedicalFieldVisible(profile?.medical_visible_fields ?? null, key)

  const [draft, setDraft] = useState<ReportDraft>(initial)
  const [saving, setSaving] = useState(false)
  const [datePicker, setDatePicker] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEscapeKey(() => navigate(-1))

  const update = (patch: Partial<ReportDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

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

  function setUrl(i: number, value: string) {
    setDraft((d) => ({
      ...d,
      document_urls: d.document_urls.map((u, j) => (j === i ? value : u)),
    }))
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
          {id ? 'Edit Report' : 'New Report'}
        </h1>
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
          disabled={saving || (!!id && !dirty)}
        >
          {saving ? 'Saving…' : id ? 'SAVE' : 'CREATE'}
        </PrimaryButton>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {!id && profile?.medical_importer_enabled && (
          <button
            onClick={() => openSheet(routes.medical.import)}
            className="flex items-center justify-center gap-2 rounded-input bg-input py-2 text-sm text-accent"
          >
            <IconUpload size={16} /> Import from JSON / CSV…
          </button>
        )}

        <div>
          <p className="mb-1 text-xs text-text-secondary">Report Date</p>
          <button
            onClick={() => setDatePicker(true)}
            className={`text-left ${inputClass}`}
          >
            {formatDayLabel(draft.report_date)}
          </button>
        </div>

        <div>
          <p className="mb-1 text-xs text-text-secondary">Type</p>
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

        {usesBodyPart(draft.report_type) && vis('body_part') && (
          <label className="text-xs text-text-secondary">
            Body Part
            <input
              value={draft.body_part}
              onChange={(e) => update({ body_part: e.target.value })}
              placeholder="e.g. neck, breast, pelvis"
              className={`mt-1 ${inputClass}`}
            />
          </label>
        )}

        {vis('provider') && (
          <label className="text-xs text-text-secondary">
            Provider
            <input
              value={draft.provider}
              onChange={(e) => update({ provider: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        )}

        {vis('narrative') && (
          <label className="text-xs text-text-secondary">
            Narrative
            <textarea
              value={draft.narrative}
              onChange={(e) => update({ narrative: e.target.value })}
              rows={3}
              placeholder="MRI / imaging / eye findings, doctor's comments"
              className={`mt-1 ${inputClass} resize-none`}
            />
          </label>
        )}

        {vis('document_urls') && (
          <div>
            <p className="mb-1 text-xs text-text-secondary">
              Document Links (Google Drive)
            </p>
            <div className="flex flex-col gap-2">
              {draft.document_urls.map((u, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={u}
                    onChange={(e) => setUrl(i, e.target.value)}
                    placeholder="https://drive.google.com/…"
                    className={inputClass}
                  />
                  <button
                    onClick={() => removeUrl(i)}
                    aria-label="Remove link"
                    className="p-1 text-text-tertiary"
                  >
                    <IconX size={18} />
                  </button>
                </div>
              ))}
              <button
                onClick={addUrl}
                className="flex items-center gap-1.5 self-start text-sm text-accent"
              >
                <IconPlus size={16} /> Add link
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.08em] text-text-secondary">
              Results
            </p>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 text-sm text-accent"
            >
              <IconPlus size={16} /> Add result
            </button>
          </div>
          {draft.results.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-tertiary">
              No results yet. Tap “Add result”.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {draft.results.map((r) => (
                <MedicalResultCard
                  key={r.clientId}
                  row={r}
                  onChange={(patch) => updateResult(r.clientId, patch)}
                  onRemove={() => removeResult(r.clientId)}
                />
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
        <MedicalTestPickerSheet
          onSelect={addFromTest}
          onAddCustom={addCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}
