import { IconChevronRight } from '@tabler/icons-react'
import { SectionCard } from './SectionCard'
import { FieldRow } from './FieldRow'
import { SegmentedTabs } from './SegmentedTabs'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { routes } from '../constants/routes'
import {
  applyFontSize,
  FONT_SIZE_LABELS,
  FONT_SIZES,
  type FontSize,
} from '../lib/font-scale'

/**
 * The DISPLAY settings section — Font Size, Visible Modules, Units — shared by global Settings and
 * the first-run Onboarding wizard so the two screens stay identical. Fully controlled: the parent
 * owns the values and decides persistence (Settings auto-saves each change; Onboarding collects them
 * and writes once on "Get started"). Changing Font Size also applies the preset instantly here
 * (whole-UI feedback) — the parent only has to persist it.
 *
 * "Visible Modules" opens the route-based `VisibleModulesSheet`. From Onboarding that sheet must
 * paint above the gate, which is why the Onboarding overlay sits below the sheet layer (see
 * `Onboarding`); the Units control stays display-only (DB stays metric).
 */
export function DisplaySettingsCard({
  fontSize,
  onFontSizeChange,
  units,
  onUnitsChange,
}: {
  fontSize: FontSize
  onFontSizeChange: (size: FontSize) => void
  units: string
  onUnitsChange: (units: string) => void
}) {
  const openSheet = useSheetNavigate()

  function changeFontSize(size: FontSize) {
    applyFontSize(size)
    onFontSizeChange(size)
  }

  return (
    <SectionCard title="Display">
      <FieldRow label="Font Size">
        <div className="w-56">
          <SegmentedTabs
            value={fontSize}
            onChange={changeFontSize}
            options={FONT_SIZES.map((s) => ({ value: s, label: FONT_SIZE_LABELS[s] }))}
          />
        </div>
      </FieldRow>
      <button
        onClick={() => openSheet(routes.settingsVisibleModules)}
        className="w-full border-b border-border last:border-b-0"
      >
        <FieldRow label="Visible Modules" hint="(Home)">
          <IconChevronRight size={18} className="text-text-tertiary" />
        </FieldRow>
      </button>
      <FieldRow label="Units">
        <div className="w-40">
          <SegmentedTabs
            value={units}
            onChange={onUnitsChange}
            options={[
              { value: 'metric', label: 'Metric' },
              { value: 'imperial', label: 'Imperial' },
            ]}
          />
        </div>
      </FieldRow>
    </SectionCard>
  )
}
