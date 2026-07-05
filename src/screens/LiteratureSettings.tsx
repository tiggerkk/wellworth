import { IconChevronRight } from '@tabler/icons-react'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { SectionCard } from '../components/SectionCard'
import { SettingsLayout } from '../components/SettingsLayout'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SPEECH_LANG_OPTIONS, type SpeechLang } from '../lib/literature'
import { routes } from '../constants/routes'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Literature sub-settings — 顯示 (per-field visibility for the Poem/Poet detail screens) + 朗讀
 * (read-aloud auto-loop + default language). Auto-saves on change.
 */
export function LiteratureSettings() {
  const { profile, loading, save } = useProfileEditor()

  return (
    <SettingsLayout title="萬卷詩書 Settings" closeLabel="關閉">
      {loading && <p className="text-body text-text-secondary">載入中…</p>}
      {!loading && !profile && <p className="text-body text-danger">無法載入設定。</p>}
      {profile && <Body profile={profile} save={save} />}
    </SettingsLayout>
  )
}

function Body({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  const openSheet = useSheetNavigate()
  const lang: SpeechLang = profile.literature_tts_lang === 'zh-CN' ? 'zh-CN' : 'zh-HK'
  return (
    <>
      <SectionCard title="顯示">
        <button
          onClick={() => openSheet(routes.literature.settingsVisiblePoem)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="可見詩書欄位">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
        <button
          onClick={() => openSheet(routes.literature.settingsVisibleWriter)}
          className="w-full border-b border-border last:border-b-0"
        >
          <FieldRow label="可見名家欄位">
            <IconChevronRight size={18} className="text-text-tertiary" />
          </FieldRow>
        </button>
      </SectionCard>

      <SectionCard title="朗讀">
        <FieldRow label="自動循環">
          <Toggle
            checked={profile.literature_tts_autoloop}
            onChange={(on) => void save({ literature_tts_autoloop: on })}
            label="自動循環"
          />
        </FieldRow>
        <FieldRow label="預設語言">
          <div className="w-24">
            <SegmentedTabs
              options={SPEECH_LANG_OPTIONS}
              value={lang}
              onChange={(l) => void save({ literature_tts_lang: l })}
            />
          </div>
        </FieldRow>
      </SectionCard>
    </>
  )
}
