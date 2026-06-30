import { useState } from 'react'
import { IconPlayerPlayFilled, IconPlayerStopFilled } from '@tabler/icons-react'
import { useSpeech } from '../hooks/useSpeech'
import { SegmentedTabs } from './SegmentedTabs'
import { SPEECH_LANG_OPTIONS, type SpeechLang } from '../lib/literature'

interface PoemReaderProps {
  /** Poem text to read (HTML already stripped). */
  text: string
  /** Initial 粵/國 selection, from profile.literature_tts_lang. */
  defaultLang: SpeechLang
  /** profile.literature_tts_autoloop (自動循環). */
  autoLoop: boolean
}

/**
 * Read-aloud player for the Poem-detail screen: a 粵/國 toggle, a play/stop button, and a 0–100%
 * progress slider that doubles as a seek control. Wraps {@link useSpeech} (Web Speech API). Styling
 * uses design-system role tokens; the progress control is a range input (no iOS zoom concern).
 */
export function PoemReader({ text, defaultLang, autoLoop }: PoemReaderProps) {
  const [lang, setLang] = useState<SpeechLang>(defaultLang)
  const { supported, voiceAvailable, speaking, progress, play, stop, seek } = useSpeech({
    text,
    lang,
    autoLoop,
  })

  if (!supported) {
    return (
      <p className="rounded-card border border-border bg-surface p-3 text-caption text-text-tertiary">
        此裝置不支援朗讀功能。
      </p>
    )
  }

  const pct = Math.round(progress * 100)

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="w-24">
          <SegmentedTabs
            options={SPEECH_LANG_OPTIONS}
            value={lang}
            onChange={(l) => {
              stop() // switching voice mid-read shouldn't keep speaking the old one
              setLang(l)
            }}
          />
        </div>
        <span className="flex-1 text-caption text-text-tertiary">
          {!voiceAvailable && `此裝置缺少${lang === 'zh-HK' ? '粵語' : '國語'}語音`}
        </span>
        <button
          onClick={() => (speaking ? stop() : play())}
          aria-label={speaking ? '停止朗讀' : '朗讀'}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-bg"
        >
          {speaking ? (
            <IconPlayerStopFilled size={18} />
          ) : (
            <IconPlayerPlayFilled size={18} />
          )}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => seek(Number(e.target.value) / 100)}
          aria-label="朗讀進度"
          className="h-1 w-full accent-accent"
        />
        <span className="w-10 shrink-0 text-right text-caption text-text-tertiary">
          {pct}%
        </span>
      </div>
    </div>
  )
}
