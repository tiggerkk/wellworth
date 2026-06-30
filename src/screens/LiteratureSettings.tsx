import { useNavigate } from 'react-router'
import { IconChevronLeft } from '@tabler/icons-react'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { SectionCard } from '../components/SectionCard'
import { FieldRow } from '../components/FieldRow'
import { Toggle } from '../components/Toggle'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SPEECH_LANG_OPTIONS, type SpeechLang } from '../lib/literature'
import type { Tables, TablesUpdate } from '../types/database'

type SaveFn = (patch: TablesUpdate<'profile'>) => Promise<void>

/**
 * Literature sub-settings — read-aloud preferences (auto-loop + default language). Reached from the
 * module's Settings tab; mirrors the other modules' Settings split. Auto-saves on change.
 */
export function LiteratureSettings() {
  const { profile, loading, save } = useProfileEditor()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-bg/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="返回"
          className="-ml-1 p-1 text-text-secondary"
        >
          <IconChevronLeft size={22} />
        </button>
        <h1 className="text-title font-medium text-text-primary">Literature Settings</h1>
      </header>
      {loading && <p className="text-body text-text-secondary">載入中…</p>}
      {!loading && !profile && <p className="text-body text-danger">無法載入設定。</p>}
      {profile && <Body profile={profile} save={save} />}
    </div>
  )
}

function Body({ profile, save }: { profile: Tables<'profile'>; save: SaveFn }) {
  const lang: SpeechLang = profile.literature_tts_lang === 'zh-CN' ? 'zh-CN' : 'zh-HK'
  return (
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
  )
}
