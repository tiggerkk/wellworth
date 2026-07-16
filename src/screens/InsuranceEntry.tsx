import { useCallback, useMemo, useRef, useState } from 'react'

import { useNavigate, useParams } from 'react-router'
import { IconArrowsLeftRight, IconCheck, IconUpload, IconX } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useDirty } from '../hooks/useDirty'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useProfile } from '../hooks/useProfile'
import { EntryLoader } from '../components/EntryLoader'
import { EntryHeaderTitle } from '../components/EntryHeaderTitle'
import { IconAction } from '../components/IconAction'
import { InsuranceCompareOverlay } from '../components/InsuranceCompareOverlay'
import { InsurancePolicyHeader } from '../components/InsurancePolicyHeader'
import {
  addScheduleVersion,
  createPolicy,
  deletePolicy,
  deleteSchedule,
  getPolicyWithSchedules,
  replaceScheduleVersion,
  savePolicyFields,
  updateScheduleEffectiveDate,
} from '../data/insurance'
import { FIELD_CLASS as inputClass } from '../constants/forms'
import { bumpNetWorth } from '../lib/networth-refresh'
import { errorMessage } from '../lib/errors'
import { parseCsv } from '../lib/csv'
import { parseInsuranceSingleCsv, type ParsedSinglePolicy } from '../lib/insurance-import'
import { NETWORTH_CURRENCIES, type NetWorthCurrency } from '../constants/networth'
import {
  gainLossClass,
  sortSchedulesDesc,
  surrenderGainPctPerYear,
  type ScheduleVersion,
} from '../lib/networth'
import { effectiveProviders, type InsuranceProviderConfig } from '../lib/insurance-config'
import { formatFullDate, todayLocal } from '../lib/date'
import { routes } from '../constants/routes'
import { showToast } from '../lib/toast'
import type { TablesUpdate } from '../types/database'
import { Calendar } from '../components/Calendar'
import { SelectMenu } from '../components/SelectMenu'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { ConfirmDeleteAction } from '../components/ConfirmDeleteAction'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { OverlayTop } from '../components/OverlayTop'
import { OverlayCloseButton } from '../components/OverlayCloseButton'

type TerminationKind = 'surrendered' | 'matured'

interface PolicyDraft {
  provider: string // configured provider key
  policy_number: string
  policy_name: string
  start_date: string | null
  currency: NetWorthCurrency
  notes: string
  // Termination = surrender OR maturity (mutually exclusive). null kind = active policy.
  termination_kind: TerminationKind | null
  termination_date: string | null
  termination_effective_date: string | null
  termination_proceeds: string // editable numeric
}

function blankDraft(providers: InsuranceProviderConfig[]): PolicyDraft {
  const first = providers[0]
  return {
    provider: first?.key ?? '',
    policy_number: '',
    policy_name: '',
    start_date: null,
    currency: first?.defaultCurrency ?? 'HKD',
    notes: '',
    termination_kind: null,
    termination_date: null,
    termination_effective_date: null,
    termination_proceeds: '',
  }
}

const CCY_OPTIONS = NETWORTH_CURRENCIES.map((c) => ({ value: c, label: c }))

function scheduleLabel(v: ScheduleVersion): string {
  const prefix = v.kind === 'original' ? '(O)' : '(U)'
  return v.effective_date ? `${prefix} ${formatFullDate(v.effective_date)}` : prefix
}

export function InsuranceEntry() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  // Memoize so `providers` keeps a stable identity across renders — it feeds `loadFn`'s deps, and a
  // fresh array each render would make `loadFn` change every render and spin `useAsync` into an
  // infinite re-fetch/re-render loop (same guard NetWorthEntry uses).
  const providers = useMemo(
    () => effectiveProviders(profile?.insurance_providers),
    [profile?.insurance_providers],
  )
  // Owner's current insurance age (drives single-import maturity auto-detect); NaN if no birthday.
  const birthYear = profile?.birthday ? Number(profile.birthday.slice(0, 4)) : NaN
  const currentAge = Number.isFinite(birthYear)
    ? Number(todayLocal().slice(0, 4)) - birthYear
    : NaN

  const loadFn = useCallback(async () => {
    if (!id || !userId)
      return { draft: blankDraft(providers), schedules: [] as ScheduleVersion[] }
    const data = await getPolicyWithSchedules(userId, id)
    if (!data) return null
    const p = data.policy
    return {
      draft: {
        provider: p.provider,
        policy_number: p.policy_number,
        policy_name: p.policy_name,
        start_date: p.start_date,
        currency: (p.currency as NetWorthCurrency) ?? 'USD',
        notes: p.notes ?? '',
        termination_kind: (p.termination_kind as TerminationKind | null) ?? null,
        termination_date: p.termination_date,
        termination_effective_date: p.termination_effective_date,
        termination_proceeds:
          p.termination_proceeds == null ? '' : String(p.termination_proceeds),
      },
      schedules: data.schedules,
    }
    // providers only affect the blank-draft default; re-resolving on profile load is harmless.
  }, [id, userId, providers])
  const { data: initial, loading, error } = useAsync(loadFn)

  useEscapeKey(() => navigate(-1))

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* 
        This outer header is always mounted! 
        It displays "Loading..." gracefully with the header structure perfectly intact.
      */}
      <EntryHeaderTitle
        title={id ? 'Edit Insurance' : 'New Insurance'}
        actions={<div className="w-24 shrink-0" />}
      />

      <EntryLoader
        loading={loading}
        error={error}
        data={initial}
        errorText="Couldn’t load this policy."
      >
        {(d) => (
          <PolicyForm
            key={id ?? 'new'}
            id={id}
            userId={userId ?? ''}
            initialDraft={d.draft}
            initialSchedules={d.schedules}
            providers={providers}
            currentAge={currentAge}
          />
        )}
      </EntryLoader>
    </div>
  )
}

function PolicyForm({
  id,
  userId,
  initialDraft,
  initialSchedules,
  providers,
  currentAge,
}: {
  id: string | undefined
  userId: string
  initialDraft: PolicyDraft
  initialSchedules: ScheduleVersion[]
  providers: InsuranceProviderConfig[]
  currentAge: number
}) {
  const navigate = useNavigate()
  const providerOptions = providers.map((p) => ({ value: p.key, label: p.label }))
  const [draft, setDraft] = useState<PolicyDraft>(initialDraft)
  // Baseline for dirty / RESET; re-seeded after a schedule import changes policy fields.
  const [baseline, setBaseline] = useState<PolicyDraft>(initialDraft)
  const [schedules, setSchedules] = useState<ScheduleVersion[]>(initialSchedules)
  const [selectedSchedule, setSelectedSchedule] = useState<string>(
    sortSchedulesDesc(initialSchedules)[0]?.id ?? '',
  )
  const [saving, setSaving] = useState(false)
  // Which kind's section is being opened on a not-yet-terminated policy (null = neither).
  const [markingKind, setMarkingKind] = useState<TerminationKind | null>(null)
  const [confirmUnmark, setConfirmUnmark] = useState(false)
  const [cal, setCal] = useState<'start' | 'termDate' | 'termEff' | 'eff' | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)

  const update = (patch: Partial<PolicyDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = useDirty(draft, baseline)
  const isTerminated = !!draft.termination_effective_date
  // The kind whose section is shown: the persisted kind, else the one being opened.
  const activeKind: TerminationKind | null = draft.termination_kind ?? markingKind
  const isMaturity = activeKind === 'matured'

  async function reload() {
    if (!id) return
    const data = await getPolicyWithSchedules(userId, id)
    if (data) {
      setSchedules(data.schedules)
      setSelectedSchedule((s) =>
        data.schedules.some((v) => v.id === s)
          ? s
          : (sortSchedulesDesc(data.schedules)[0]?.id ?? ''),
      )
    }
  }

  function validateRequired(): boolean {
    if (!draft.policy_number.trim()) {
      showToast('Policy number is required')
      return false
    }
    if (
      (markingKind || isTerminated) &&
      !(
        draft.termination_date &&
        draft.termination_effective_date &&
        draft.termination_proceeds.trim()
      )
    ) {
      showToast(
        `${isMaturity ? 'Maturity' : 'Surrender'} needs a date, effective-from, and proceeds`,
      )
      return false
    }
    return true
  }

  function policyPatch() {
    return {
      provider: draft.provider,
      policy_number: draft.policy_number.trim(),
      policy_name: draft.policy_name.trim(),
      start_date: draft.start_date,
      currency: draft.currency,
      notes: draft.notes.trim() || null,
      termination_kind: draft.termination_kind,
      termination_date: draft.termination_date,
      termination_effective_date: draft.termination_effective_date,
      termination_proceeds: draft.termination_proceeds.trim()
        ? Number(draft.termination_proceeds)
        : null,
    }
  }

  async function save() {
    if (!validateRequired()) return
    setSaving(true)
    try {
      if (id) {
        await savePolicyFields(id, policyPatch())
      } else {
        await createPolicy(userId, policyPatch())
      }
      bumpNetWorth()
      navigate(-1)
    } catch (e) {
      showToast(errorMessage(e, 'Could not save the policy.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!id) return
    setSaving(true)
    try {
      await deletePolicy(id)
      bumpNetWorth()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  // Start marking a not-yet-terminated policy (mutually exclusive — only one section opens).
  function startMarking(kind: TerminationKind) {
    setMarkingKind(kind)
  }
  // Cancel before the date is set (no fields persisted yet); clear any stray draft values.
  function cancelMarking() {
    setMarkingKind(null)
    update({
      termination_kind: null,
      termination_date: null,
      termination_effective_date: null,
      termination_proceeds: '',
    })
  }
  function unmark() {
    setConfirmUnmark(false)
    setMarkingKind(null)
    update({
      termination_kind: null,
      termination_date: null,
      termination_effective_date: null,
      termination_proceeds: '',
    })
  }

  // --- Apply a parsed single-policy import (create-or-attach / add-or-replace) ----------
  async function applyImport(
    parsed: ParsedSinglePolicy,
    target: { mode: 'new' } | { mode: 'replace'; scheduleId: string },
  ) {
    setSaving(true)
    try {
      let policyId = id
      if (!policyId) {
        const created = await createPolicy(userId, policyPatch())
        policyId = created.id
      }
      const hasOriginal = schedules.some((v) => v.kind === 'original')

      // The file may override name / notes, and auto-detected maturity. start_date is the policy's
      // inception date — only the ORIGINAL schedule's file should set it; on an update import the
      // same "number: date" cell means this version's effective date instead (handled below).
      const overridePatch: TablesUpdate<'insurance_policy'> = {}
      if (parsed.policy_name) overridePatch.policy_name = parsed.policy_name
      if (parsed.start_date && !hasOriginal) overridePatch.start_date = parsed.start_date
      if (parsed.notes) overridePatch.notes = parsed.notes
      if (parsed.termination_kind) {
        overridePatch.termination_kind = parsed.termination_kind
        overridePatch.termination_date = parsed.termination_date
        overridePatch.termination_effective_date = parsed.termination_effective_date
        overridePatch.termination_proceeds = parsed.termination_proceeds
      }
      if (Object.keys(overridePatch).length > 0) {
        await savePolicyFields(policyId, overridePatch)
      }

      if (target.mode === 'replace') {
        await replaceScheduleVersion(target.scheduleId, {
          first_year: parsed.first_year,
          points: parsed.points,
        })
      } else {
        const effective =
          parsed.start_date ?? // explicit date from the file — trust it as-is
          (hasOriginal
            ? `${todayLocal().slice(0, 4)}-${(draft.start_date ?? todayLocal()).slice(5)}`
            : (draft.start_date ?? `${todayLocal().slice(0, 4)}-01-01`))
        await addScheduleVersion(policyId, {
          kind: hasOriginal ? 'update' : 'original',
          first_year: parsed.first_year,
          effective_date: effective,
          points: parsed.points,
        })
      }
      bumpNetWorth()
      setImportOpen(false)
      if (!id) {
        navigate(routes.networth.insuranceEdit(policyId), { replace: true })
      } else {
        applyImportOverrides(parsed)
        await reload()
      }
    } catch (e) {
      showToast(errorMessage(e, 'Import failed.'))
    } finally {
      setSaving(false)
    }
  }

  // Reflect the file's policy-field overrides into the on-screen draft + baseline (so the section
  // shows and the form isn't falsely "dirty") after they've been persisted.
  function applyImportOverrides(parsed: ParsedSinglePolicy) {
    const o: Partial<PolicyDraft> = {}
    if (parsed.policy_name) o.policy_name = parsed.policy_name
    if (parsed.start_date) o.start_date = parsed.start_date
    if (parsed.notes) o.notes = parsed.notes
    if (parsed.termination_kind) {
      o.termination_kind = parsed.termination_kind
      o.termination_date = parsed.termination_date
      o.termination_effective_date = parsed.termination_effective_date
      o.termination_proceeds =
        parsed.termination_proceeds == null ? '' : String(parsed.termination_proceeds)
    }
    if (Object.keys(o).length > 0) {
      setDraft((d) => ({ ...d, ...o }))
      setBaseline((b) => ({ ...b, ...o }))
    }
  }

  const selected = schedules.find((v) => v.id === selectedSchedule) ?? null
  // `schedules` only changes on load/reload/import; every other state change in this form (draft
  // field edits, calendar picks, etc.) re-renders without touching it, so sorting it here once per
  // actual schedules change avoids a re-sort per keystroke.
  const schedulesDesc = useMemo(() => sortSchedulesDesc(schedules), [schedules])

  async function onPickCalendar(d: string) {
    if (cal === 'start') update({ start_date: d })
    // Setting/changing the termination Date re-syncs "Effective From" to match; the user can then
    // override it independently. Both set the kind from the section being marked.
    else if (cal === 'termDate')
      update({
        termination_date: d,
        termination_effective_date: d,
        termination_kind: activeKind,
      })
    else if (cal === 'termEff')
      update({ termination_effective_date: d, termination_kind: activeKind })
    else if (cal === 'eff' && selected && id) {
      await updateScheduleEffectiveDate(selected.id, d)
      bumpNetWorth()
      await reload()
    }
    setCal(null)
  }

  return (
    <>
      {/* 
        This floats actions perfectly over the empty right side of the outer mounted header.
        Because it is absolute positioned relative to the outer boundary, it stays secure on mobile viewports.
      */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-3">
        <EntryHeaderActions
          editing={!!id}
          dirty={dirty}
          saving={saving}
          onReset={() => setDraft(baseline)}
          onSubmit={() => void save()}
          onDelete={id ? () => void remove() : undefined}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-caption text-text-secondary">Provider</p>
            <SelectMenu
              value={draft.provider}
              options={providerOptions}
              onChange={(v) => update({ provider: v })}
              ariaLabel="Provider"
              className="w-full"
              size="field"
            />
          </div>
          <div className="shrink-0">
            <p className="mb-1 text-caption text-text-secondary">Currency</p>
            <SegmentedTabs
              value={draft.currency}
              options={CCY_OPTIONS}
              onChange={(v) => update({ currency: v as NetWorthCurrency })}
              size="field"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex-1 text-caption text-text-secondary">
            Policy Number
            <input
              value={draft.policy_number}
              onChange={(e) => update({ policy_number: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="flex-1">
            <p className="mb-1 text-caption text-text-secondary">Start Date</p>
            <button onClick={() => setCal('start')} className={`text-left ${inputClass}`}>
              {draft.start_date ? (
                formatFullDate(draft.start_date)
              ) : (
                <span className="text-text-tertiary">Set date</span>
              )}
            </button>
          </div>
        </div>

        <label className="text-caption text-text-secondary">
          Policy Name
          <input
            value={draft.policy_name}
            onChange={(e) => update({ policy_name: e.target.value })}
            className={`mt-1 ${inputClass}`}
          />
        </label>

        <label className="text-caption text-text-secondary">
          Notes
          <textarea
            value={draft.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={2}
            className={`mt-1 ${inputClass} resize-none`}
          />
        </label>

        {/* TERMINATION — surrender OR maturity (mutually exclusive) */}
        <div>
          {activeKind ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-section uppercase tracking-[0.08em] text-text-secondary">
                  {isMaturity ? 'Maturity' : 'Surrender'}
                </p>
                {isTerminated ? (
                  confirmUnmark ? (
                    <div className="flex items-center gap-1">
                      <span className="text-caption text-text-secondary">
                        {isMaturity ? 'Un-mature?' : 'Un-surrender?'}
                      </span>
                      <button
                        onClick={unmark}
                        aria-label="Confirm un-mark"
                        className="p-1 text-danger"
                      >
                        <IconCheck size={18} />
                      </button>
                      <button
                        onClick={() => setConfirmUnmark(false)}
                        aria-label="Cancel un-mark"
                        className="p-1 text-text-secondary"
                      >
                        <IconX size={18} />
                      </button>
                    </div>
                  ) : (
                    <SecondaryButton size="sm" onClick={() => setConfirmUnmark(true)}>
                      {isMaturity ? 'Un-Mature' : 'Un-Surrender'}
                    </SecondaryButton>
                  )
                ) : (
                  <SecondaryButton size="sm" onClick={cancelMarking}>
                    Cancel
                  </SecondaryButton>
                )}
              </div>
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="mb-1 text-caption text-text-secondary">
                      {isMaturity ? 'Maturity Date' : 'Surrender Date'}
                    </p>
                    <button
                      onClick={() => setCal('termDate')}
                      className={`text-left ${inputClass}`}
                    >
                      {draft.termination_date ? (
                        formatFullDate(draft.termination_date)
                      ) : (
                        <span className="text-text-tertiary">Set date</span>
                      )}
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-caption text-text-secondary">
                      {isMaturity
                        ? 'Maturity Effective From'
                        : 'Surrender Effective From'}
                    </p>
                    <button
                      onClick={() => setCal('termEff')}
                      className={`text-left ${inputClass}`}
                    >
                      {draft.termination_effective_date ? (
                        formatFullDate(draft.termination_effective_date)
                      ) : (
                        <span className="text-text-tertiary">Set date</span>
                      )}
                    </button>
                  </div>
                </div>
                <label className="text-caption text-text-secondary">
                  Actual Proceeds
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={draft.termination_proceeds}
                    onChange={(e) => update({ termination_proceeds: e.target.value })}
                    className={`no-spinner mt-1 ${inputClass}`}
                  />
                </label>
                <p className="text-caption text-text-tertiary">
                  Enter the cash received {isMaturity ? 'into' : 'as'} Cash in Monthly
                  Entry.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-section uppercase tracking-[0.08em] text-text-secondary">
                Termination
              </p>
              <div className="flex items-center gap-2">
                <SecondaryButton size="sm" onClick={() => startMarking('surrendered')}>
                  Mark Surrendered
                </SecondaryButton>
                <SecondaryButton size="sm" onClick={() => startMarking('matured')}>
                  Mark Matured
                </SecondaryButton>
              </div>
            </div>
          )}
        </div>

        {/* SCHEDULE */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-section uppercase tracking-[0.08em] text-text-secondary">
              Schedule
            </p>
            <button
              onClick={() => setImportOpen(true)}
              className="flex shrink-0 items-center gap-1.5 text-body text-accent"
            >
              <IconUpload size={16} /> Schedule
            </button>
          </div>
          {!id ? (
            <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-body text-text-tertiary">
              Save the policy, then import a schedule — or use the Schedule button above
              to create it from a file.
            </p>
          ) : schedules.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-body text-text-tertiary">
              No schedule versions yet. Use the Import Schedule button above.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {selected && (
                  <button
                    onClick={() => setCal('eff')}
                    aria-label="Effective date"
                    className="field-control flex-1 text-left"
                  >
                    {selected.effective_date ? (
                      formatFullDate(selected.effective_date)
                    ) : (
                      <span className="text-text-tertiary">Set date</span>
                    )}
                  </button>
                )}
                <SelectMenu
                  value={selectedSchedule}
                  options={schedulesDesc.map((v) => ({
                    value: v.id,
                    label: scheduleLabel(v),
                  }))}
                  onChange={setSelectedSchedule}
                  ariaLabel="Schedule version"
                  className="flex-1"
                  size="field"
                />
                <IconAction
                  Icon={IconArrowsLeftRight}
                  label="Compare schedules"
                  onClick={() => setCompareOpen(true)}
                  disabled={schedules.length < 2}
                />
                {selected && (
                  <ConfirmDeleteAction
                    label="Delete schedule version"
                    onDelete={() =>
                      void deleteSchedule(id, selected.id).then(() => {
                        bumpNetWorth()
                        void reload()
                      })
                    }
                  />
                )}
              </div>
              {selected && (
                <div className="overflow-hidden rounded-card border border-border bg-surface">
                  <div className="grid grid-cols-[2.5rem_2rem_4.5rem_1fr_1fr] gap-2 border-b border-border px-3 py-2 text-section uppercase tracking-wide text-text-secondary">
                    <span>Age</span>
                    <span>Yr</span>
                    <span className="text-right">Premium</span>
                    <span className="text-right">Cash</span>
                    <span className="text-right">Gain %/Yr</span>
                  </div>
                  {selected.points.map((p) => {
                    const gain = surrenderGainPctPerYear(
                      p.cash_value,
                      p.total_premium_paid,
                      p.policy_year,
                    )
                    return (
                      <div
                        key={p.age}
                        className="grid grid-cols-[2.5rem_2rem_4.5rem_1fr_1fr] gap-2 border-b border-border px-3 py-1.5 text-label text-text-primary last:border-b-0"
                      >
                        <span>{p.age}</span>
                        <span className="text-text-secondary">{p.policy_year}</span>
                        <span className="text-right">
                          {Math.round(p.total_premium_paid).toLocaleString('en-US')}
                        </span>
                        <span className="text-right">
                          {Math.round(p.cash_value).toLocaleString('en-US')}
                        </span>
                        <span className={`text-right ${gainLossClass(gain)}`}>
                          {gain.toFixed(2)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {cal && (
        <Calendar
          day={
            (cal === 'start'
              ? draft.start_date
              : cal === 'termEff'
                ? draft.termination_effective_date
                : cal === 'termDate'
                  ? draft.termination_date
                  : selected?.effective_date) ?? todayLocal()
          }
          onSelect={(d) => void onPickCalendar(d)}
          onClose={() => setCal(null)}
        />
      )}

      {importOpen && (
        <ImportScheduleOverlay
          provider={draft.provider}
          providers={providers}
          policyNumber={draft.policy_number.trim()}
          startDate={draft.start_date}
          policyName={draft.policy_name}
          schedules={schedules}
          currentAge={currentAge}
          busy={saving}
          onApply={applyImport}
          onClose={() => setImportOpen(false)}
        />
      )}

      {compareOpen && schedules.length >= 2 && (
        <InsuranceCompareOverlay
          policyNumber={draft.policy_number}
          startDate={draft.start_date}
          providerLabel={
            providers.find((p) => p.key === draft.provider)?.label ?? draft.provider
          }
          policyName={draft.policy_name}
          schedules={schedules}
          currency={draft.currency}
          initialAId={
            schedules.find((v) => v.kind === 'original')?.id ?? schedules[0]!.id
          }
          initialBId={selectedSchedule || schedules[0]!.id}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </>
  )
}

// --- Local import overlay (does not remount the form) ------------------------------------

function ImportScheduleOverlay({
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

  const canApply = parsed != null && parseErrors.length === 0 && !mismatch && !busy

  return (
    <OverlayTop onClose={onClose} label="Import Policy Schedule">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <OverlayCloseButton onClick={onClose} />
        <h1 className="text-heading font-medium text-text-primary">
          Import Policy Schedule
        </h1>
      </header>
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
      <div className="border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <PrimaryButton
          onClick={() =>
            parsed &&
            onApply(
              parsed,
              mode === 'new' ? { mode: 'new' } : { mode: 'replace', scheduleId: mode },
            )
          }
          disabled={!canApply}
          className="w-full"
        >
          {busy ? 'Importing…' : 'IMPORT SCHEDULE'}
        </PrimaryButton>
      </div>
    </OverlayTop>
  )
}
