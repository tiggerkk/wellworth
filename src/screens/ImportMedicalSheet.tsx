import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconPlus, IconUpload, IconX } from '@tabler/icons-react'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { Sheet } from '../components/Sheet'
import { ImportSheetFooter } from '../components/ImportSheetFooter'
import { Calendar } from '../components/Calendar'
import { SelectMenu } from '../components/SelectMenu'
import { MedicalResultCard } from '../components/MedicalResultCard'
import { MedicalTestPickerOverlay } from '../components/MedicalTestPickerOverlay'
import { useAuth } from '../auth/AuthProvider'
import { saveImportedReport } from '../data/medical'
import { bumpMedical } from '../lib/medical-refresh'
import { errorMessage } from '../lib/errors'
import { parseMedicalFile } from '../lib/medical-import'
import {
  blankResultDraft,
  draftToSaveInput,
  parsedReportToDraft,
  type ReportDraft,
} from '../lib/medical-draft'
import {
  MEDICAL_CATEGORIES,
  MEDICAL_CATEGORY_LABELS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  type MedicalLabTestSeed,
} from '../constants/medical'
import { orderResultsForDisplay, usesBodyPart } from '../lib/medical'
import { groupResultsByCategory } from '../lib/medical-order'
import { useProfile } from '../hooks/useProfile'
import { formatFullDate } from '../lib/date'
import { routes } from '../constants/routes'
import { FIELD_CLASS as inputClass } from '../constants/forms'

/**
 * Import a structured JSON/CSV report → review → save. The parse (tolerant JSON repair, fuzzy
 * test-key match, unit normalization) is pure (`medical-import.ts`); this screen is the **mandatory
 * review**: it shows counts per category (to catch omitted sections), lets the owner edit/add/remove
 * rows (the same `MedicalResultCard` editor as manual entry) and paste the Drive link(s), then saves
 * idempotently (a same-date+type report is replaced).
 */
export function ImportMedicalSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [draft, setDraft] = useState<ReportDraft | null>(null)
  const [importing, setImporting] = useState(false)
  const [datePicker, setDatePicker] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  async function onFile(file: File) {
    setError(null)
    setWarnings([])
    setDraft(null)
    let text: string
    try {
      text = await file.text()
    } catch {
      setError('Could not read the file.')
      return
    }
    const result = parseMedicalFile(file.name, text)
    setFileName(file.name)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setWarnings(result.warnings)
    setDraft(parsedReportToDraft(result.report))
  }

  const update = (patch: Partial<ReportDraft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d))
  function updateResult(
    clientId: string,
    patch: Partial<ReportDraft['results'][number]>,
  ) {
    setDraft((d) =>
      d
        ? {
            ...d,
            results: d.results.map((r) =>
              r.clientId === clientId ? { ...r, ...patch } : r,
            ),
          }
        : d,
    )
  }
  function removeResult(clientId: string) {
    setDraft((d) =>
      d ? { ...d, results: d.results.filter((r) => r.clientId !== clientId) } : d,
    )
  }
  function addFromTest(test: MedicalLabTestSeed) {
    setPickerOpen(false)
    setDraft((d) =>
      d
        ? {
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
          }
        : d,
    )
  }
  function addCustom() {
    setPickerOpen(false)
    setDraft((d) =>
      d ? { ...d, results: [...d.results, blankResultDraft(null, '', 'other', '')] } : d,
    )
  }
  function setUrl(i: number, value: string) {
    setDraft((d) =>
      d
        ? { ...d, document_urls: d.document_urls.map((u, j) => (j === i ? value : u)) }
        : d,
    )
  }

  async function runImport() {
    if (!userId || !draft) return
    setImporting(true)
    setError(null)
    try {
      const { id } = await saveImportedReport(userId, draftToSaveInput(draft))
      bumpMedical()
      navigate(routes.medical.detail(id))
    } catch (e) {
      setError(errorMessage(e, 'Import failed.'))
      setImporting(false)
    }
  }

  const counts = draft
    ? MEDICAL_CATEGORIES.map((c) => ({
        c,
        n: draft.results.filter((r) => r.category === c).length,
      })).filter((x) => x.n > 0)
    : []
  const total = draft?.results.length ?? 0
  const toReview = draft?.results.filter((r) => r.uncertain).length ?? 0
  // Group the review cards by category (display order) — same sections as Report detail / Edit Report.
  const orderedResults = draft
    ? orderResultsForDisplay(
        draft.results,
        profile?.medical_section_order,
        profile?.medical_test_order,
      )
    : []

  return (
    <Sheet variant="full" label="Import Medical report">
      <ScreenHeaderTitle title="Import Medical Report" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <p className="text-body text-text-secondary">
          Upload a <code className="text-text-primary">.json</code> (preferred) or{' '}
          <code className="text-text-primary">.csv</code> file produced from a report by
          an AI tool (see{' '}
          <code className="text-text-primary">
            templates/medical-extraction-prompt.md
          </code>
          ). Review the parsed results — especially the per-category counts, to catch a
          skipped section — then paste your Google Drive link(s) and save.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json,.csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-body text-text-primary"
        >
          <IconUpload size={18} />
          {fileName ? 'Choose a different file' : 'Choose JSON/CSV File'}
        </button>
        {fileName && (
          <p className="text-caption text-text-secondary">
            Selected: <span className="text-text-primary">{fileName}</span>
          </p>
        )}

        {error && <p className="text-body text-danger">{error}</p>}

        {draft && (
          <>
            <div className="rounded-card border border-border bg-surface p-3">
              <p className="text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
                Parsed {total} result{total === 1 ? '' : 's'}
                {toReview > 0 ? ` · ${toReview} to review` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {counts.map(({ c, n }) => (
                  <span
                    key={c}
                    className="rounded-pill bg-input px-2 py-0.5 text-section text-text-secondary"
                  >
                    {MEDICAL_CATEGORY_LABELS[c]} {n}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-section text-text-tertiary">
                A missing section? Check the counts against the report, then “Add Result”.
              </p>
            </div>

            <div>
              <p className="mb-1 text-caption text-text-secondary">Report Date</p>
              <button
                onClick={() => setDatePicker(true)}
                className={`text-left ${inputClass}`}
              >
                {formatFullDate(draft.report_date)}
              </button>
            </div>

            <div>
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

            {usesBodyPart(draft.report_type) && (
              <label className="text-caption text-text-secondary">
                Body Part
                <input
                  value={draft.body_part}
                  onChange={(e) => update({ body_part: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            )}

            <label className="text-caption text-text-secondary">
              Provider
              <input
                value={draft.provider}
                onChange={(e) => update({ provider: e.target.value })}
                className={`mt-1 ${inputClass}`}
              />
            </label>

            <label className="text-caption text-text-secondary">
              Narrative
              <textarea
                value={draft.narrative}
                onChange={(e) => update({ narrative: e.target.value })}
                rows={3}
                className={`mt-1 ${inputClass} resize-none`}
              />
            </label>

            <div>
              <p className="mb-1 text-caption text-text-secondary">
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
                      onClick={() =>
                        update({
                          document_urls: draft.document_urls.filter((_, j) => j !== i),
                        })
                      }
                      aria-label="Remove link"
                      className="p-1 text-text-tertiary"
                    >
                      <IconX size={18} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => update({ document_urls: [...draft.document_urls, ''] })}
                  className="flex items-center gap-1.5 self-start text-body text-positive"
                >
                  <IconPlus size={16} /> Add Link
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-caption uppercase tracking-[0.08em] text-text-secondary">
                  Results
                </p>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1.5 text-body text-positive"
                >
                  <IconPlus size={16} /> Add Result
                </button>
              </div>
              <div className="flex flex-col gap-5">
                {groupResultsByCategory(orderedResults).map((g) => (
                  <div key={g.category} className="flex flex-col gap-2">
                    <p className="px-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
                      {MEDICAL_CATEGORY_LABELS[g.category]}
                    </p>
                    <div className="flex flex-col gap-3">
                      {g.rows.map((r) => (
                        <MedicalResultCard
                          key={r.clientId}
                          row={r}
                          onChange={(patch) => updateResult(r.clientId, patch)}
                          onRemove={() => removeResult(r.clientId)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="flex flex-col gap-1 text-caption text-text-tertiary">
                {warnings.slice(0, 20).map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
                {warnings.length > 20 && <p>…and {warnings.length - 20} more.</p>}
              </div>
            )}
          </>
        )}
      </div>

      <ImportSheetFooter
        count={total}
        importing={importing}
        disabled={!draft}
        onSubmit={() => void runImport()}
        submitLabel={(n) => `SAVE ${n} RESULT${n === 1 ? '' : 'S'}`}
        emptyLabel="SAVE REPORT"
        importingLabel="Saving…"
      />

      {datePicker && draft && (
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
    </Sheet>
  )
}
