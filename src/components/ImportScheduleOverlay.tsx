import { useRef, useState } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { ImportSheetFooter } from './ImportSheetFooter'
import { InsurancePolicyHeader } from './InsurancePolicyHeader'
import { SelectMenu } from './SelectMenu'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { errorMessage } from '../lib/errors'
import { parseCsv } from '../lib/csv'
import { parseInsuranceSingleCsv, type ParsedSinglePolicy } from '../lib/insurance-import'
import type { ScheduleVersion } from '../lib/networth'
import type { InsuranceProviderConfig } from '../lib/insurance-config'
import { formatFullDate } from '../lib/date'

/**
 * Local (non-routed) import overlay for a single policy's schedule CSV, opened from
 * `InsuranceEntry`'s local `importOpen` state rather than a route — routing here would remount
 * the form and lose whatever the person already typed into Policy Number / Provider / Start Date
 * before they'd even picked a file.
 */
export function ImportScheduleOverlay({
  provider,
  providers,
  policyNumber,
  startDate,
  policyName,
  schedules,
  currentAge,
  busy,
  onApply,
  onClose,
}: {
  provider: string
  providers: InsuranceProviderConfig[]
  policyNumber: string
  startDate: string | null
  policyName: string
  schedules: ScheduleVersion[]
  currentAge: number
  busy: boolean
  onApply: (
    parsed: ParsedSinglePolicy,
    target: { mode: 'new' } | { mode: 'replace'; scheduleId: string },
  ) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedSinglePolicy | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [mode, setMode] = useState<'new' | string>('new') // 'new' | scheduleId
  // Innermost overlay over the form — Esc closes it first (an open SelectMenu layers above this).
  useEscapeKey(onClose)

  async function onFile(file: File) {
    setParseErrors([])
    try {
      const text = await file.text()
      const res = parseInsuranceSingleCsv(parseCsv(text), providers, currentAge)
      setParsed(res.policy)
      setParseErrors(res.errors)
      setFileName(file.name)
    } catch (e) {
      setParsed(null)
      setParseErrors([errorMessage(e, 'Could not read the file.')])
    }
  }

  // Match validation: number must equal the screen's; provider (if present) must match.
  const mismatch =
    parsed != null &&
    (parsed.policy_number !== policyNumber ||
      (parsed.provider != null && parsed.provider !== provider))

  return (
    <OverlayTop onClose={onClose} label="Import Policy Schedule">
      <ScreenHeaderTitle onClose={onClose} title="Import Policy Schedule" />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <InsurancePolicyHeader
            policyNumber={policyNumber || 'New policy'}
            startDate={startDate}
            providerLabel={
              (providers.find((p) => p.key === provider)?.label ?? provider) || '—'
            }
            policyName={policyName || '—'}
          />
        </div>

        {!policyNumber && (
          <p className="text-caption text-warning">
            Enter the Policy Number first — the file must match it.
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
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
          {fileName ? 'Choose a different file' : 'Choose CSV File'}
        </button>

        {parseErrors.length > 0 && (
          <ul className="flex flex-col gap-1 text-caption text-danger">
            {parseErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}

        {parsed && (
          <div className="flex flex-col gap-3">
            <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
              {parsed.policy_number} · {parsed.points.length} schedule point
              {parsed.points.length === 1 ? '' : 's'}
              {parsed.termination_kind === 'matured' && ' · auto-detected Matured'}
            </div>
            {mismatch && (
              <p className="text-caption text-danger">
                File doesn’t match this policy’s provider / number.
              </p>
            )}
            <div>
              <p className="mb-1 text-caption uppercase tracking-[0.08em] text-text-secondary">
                Apply as
              </p>
              <SelectMenu
                value={mode}
                ariaLabel="Apply target"
                options={[
                  { value: 'new', label: 'Add new version' },
                  ...schedules.map((v) => ({
                    value: v.id,
                    label: `Replace ${v.kind === 'original' ? 'Original' : 'Update'}${v.effective_date ? ` · ${formatFullDate(v.effective_date)}` : ''}`,
                  })),
                ]}
                onChange={setMode}
              />
            </div>
          </div>
        )}
      </div>
      <ImportSheetFooter
        count={parsed ? 1 : 0}
        importing={busy}
        disabled={parseErrors.length > 0 || mismatch}
        submitLabel={() => 'IMPORT SCHEDULE'}
        emptyLabel="IMPORT SCHEDULE"
        importingLabel="Importing…"
        onSubmit={() =>
          parsed &&
          onApply(
            parsed,
            mode === 'new' ? { mode: 'new' } : { mode: 'replace', scheduleId: mode },
          )
        }
      />
    </OverlayTop>
  )
}
