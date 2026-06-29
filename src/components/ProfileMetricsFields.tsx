import { useState } from 'react'
import { SectionCard } from './SectionCard'
import { FieldRow } from './FieldRow'
import { SegmentedTabs } from './SegmentedTabs'
import { Calendar } from './Calendar'
import { cmToInches, inchesToCm, kgToPounds, poundsToKg } from '../lib/units'
import { formatFullDate, todayLocal, type IsoDate } from '../lib/date'

const round1 = (n: number) => Math.round(n * 10) / 10

/** The shared body-metric values, stored canonically (cm/kg) regardless of the display units. */
export interface ProfileMetrics {
  birthday: string | null
  sex: 'female' | 'male'
  units: string
  height_cm: number | null
  weight_kg: number | null
}

const inputCls = 'field-control w-24 text-right'

/**
 * A number input that edits a metric-stored value in the user's display units. Holds a transient
 * string draft and commits the converted metric value on blur. The parent remounts it via `key` on
 * a units switch (the React "reset state with key" pattern), so the draft re-derives in the new
 * units without an effect — typing never fights a resync because the canonical value only changes on
 * commit, after focus has already left.
 */
function MetricInput({
  metric,
  imperial,
  toDisplay,
  fromDisplay,
  onCommit,
  ariaLabel,
}: {
  metric: number | null
  imperial: boolean
  toDisplay: (metric: number, imperial: boolean) => number
  fromDisplay: (display: number, imperial: boolean) => number
  onCommit: (metric: number | null) => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState(() =>
    metric == null ? '' : String(round1(toDisplay(metric, imperial))),
  )
  function commit() {
    const n = Number(draft)
    onCommit(draft.trim() === '' || !Number.isFinite(n) ? null : fromDisplay(n, imperial))
  }
  return (
    <input
      type="number"
      step="any"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      aria-label={ariaLabel}
      className={inputCls}
    />
  )
}

/**
 * Birthday / sex / height / weight (+ optional Units) inputs, shared by global Settings and the
 * first-run Onboarding wizard so the metric↔imperial conversion lives in exactly one place.
 *
 * Fully controlled on the **canonical** value (height_cm/weight_kg in metric). `onChange(patch)`
 * fires per field as it commits (birthday/sex/units immediately, height/weight on blur) — the parent
 * decides whether that means auto-save (Settings) or just updating local state to submit later
 * (Onboarding).
 */
export function ProfileMetricsFields({
  value,
  onChange,
  showUnits = true,
}: {
  value: ProfileMetrics
  onChange: (patch: Partial<ProfileMetrics>) => void
  showUnits?: boolean
}) {
  const imperial = value.units === 'imperial'
  const [calOpen, setCalOpen] = useState(false)

  return (
    <>
      <SectionCard title="Profile">
        <FieldRow label="Birthday">
          <button
            type="button"
            onClick={() => setCalOpen(true)}
            className="field-control"
          >
            {value.birthday ? (
              formatFullDate(value.birthday as IsoDate)
            ) : (
              <span className="text-text-tertiary">Set date</span>
            )}
          </button>
        </FieldRow>
        <FieldRow label="Sex">
          <div className="w-40">
            <SegmentedTabs
              value={value.sex}
              onChange={(v) => onChange({ sex: v as 'female' | 'male' })}
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
              ]}
            />
          </div>
        </FieldRow>
        <FieldRow label={`Height (${imperial ? 'in' : 'cm'})`}>
          <MetricInput
            key={`height-${value.units}`}
            metric={value.height_cm}
            imperial={imperial}
            toDisplay={(cm, imp) => (imp ? cmToInches(cm) : cm)}
            fromDisplay={(v, imp) => (imp ? inchesToCm(v) : v)}
            onCommit={(cm) => onChange({ height_cm: cm })}
            ariaLabel="Height"
          />
        </FieldRow>
        <FieldRow label={`Weight (${imperial ? 'lb' : 'kg'})`}>
          <MetricInput
            key={`weight-${value.units}`}
            metric={value.weight_kg}
            imperial={imperial}
            toDisplay={(kg, imp) => (imp ? kgToPounds(kg) : kg)}
            fromDisplay={(v, imp) => (imp ? poundsToKg(v) : v)}
            onCommit={(kg) => onChange({ weight_kg: kg })}
            ariaLabel="Weight"
          />
        </FieldRow>
      </SectionCard>

      {showUnits && (
        <SectionCard title="Preferences">
          <FieldRow label="Units">
            <div className="w-40">
              <SegmentedTabs
                value={value.units}
                onChange={(v) => onChange({ units: v })}
                options={[
                  { value: 'metric', label: 'Metric' },
                  { value: 'imperial', label: 'Imperial' },
                ]}
              />
            </div>
          </FieldRow>
        </SectionCard>
      )}

      {calOpen && (
        <Calendar
          day={(value.birthday as IsoDate | null) ?? todayLocal()}
          onSelect={(d) => {
            onChange({ birthday: d })
            setCalOpen(false)
          }}
          onClose={() => setCalOpen(false)}
        />
      )}
    </>
  )
}
