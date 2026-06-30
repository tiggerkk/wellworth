import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpeechLang } from '../lib/literature'

interface UseSpeechOptions {
  /** Text to read (HTML already stripped by the caller). */
  text: string
  /** zh-HK (粵) or zh-CN (國). */
  lang: SpeechLang
  /** Restart from the top on finish (自動循環). */
  autoLoop?: boolean
  rate?: number
}

export interface UseSpeech {
  /** The browser exposes the Web Speech API at all. */
  supported: boolean
  /** A voice matching the selected language exists (false ⇒ warn; often the case for 粵/zh-HK on iOS). */
  voiceAvailable: boolean
  speaking: boolean
  /** 0..1, driven by the utterance `onboundary` charIndex. */
  progress: number
  play: () => void
  stop: () => void
  /** Seek to a fraction (0..1): restarts from there if speaking, else moves the marker for next play. */
  seek: (fraction: number) => void
}

const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

/**
 * Read-aloud over the Web Speech API (`speechSynthesis`). Ports the algorithm from the standalone
 * chinese-literature app: pick a zh-HK / zh-CN voice (voices load async via `voiceschanged`), drive
 * progress from `onboundary`, seek by re-speaking from a char offset, optional auto-loop. Always
 * cancels on unmount/stop so no utterance leaks after navigating away.
 *
 * iOS note: a zh-HK (Cantonese) voice is device-dependent and often absent — `voiceAvailable` then
 * reports false and playback falls back to whatever the platform picks (see docs/PARKED.md).
 */
export function useSpeech({
  text,
  lang,
  autoLoop = false,
  rate = 0.9,
}: UseSpeechOptions): UseSpeech {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    isSupported ? window.speechSynthesis.getVoices() : [],
  )
  const [speaking, setSpeaking] = useState(false)
  const [progress, setProgress] = useState(0)

  const baseOffsetRef = useRef(0) // char offset the current utterance started at (for boundary math)
  const stoppingRef = useRef(false) // suppresses the loop/restart when we cancel deliberately
  // Holds the latest `speakFrom` so the utterance's onend can restart (auto-loop) without a render-
  // time ref write or a useCallback self-reference. Synced in an effect below.
  const speakFromRef = useRef<(offset: number) => void>(() => {})

  // Voices populate asynchronously — refresh the list when the engine signals a change.
  useEffect(() => {
    if (!isSupported) return
    const synth = window.speechSynthesis
    const onChange = () => setVoices(synth.getVoices())
    synth.addEventListener('voiceschanged', onChange)
    return () => synth.removeEventListener('voiceschanged', onChange)
  }, [])

  // Cancel any in-flight speech when the reader unmounts (the component is keyed per poem).
  useEffect(() => {
    if (!isSupported) return
    return () => {
      stoppingRef.current = true
      window.speechSynthesis.cancel()
    }
  }, [])

  const pickVoice = useCallback(
    (l: SpeechLang): SpeechSynthesisVoice | null => {
      const want = l.toLowerCase()
      const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase()
      return (
        voices.find((v) => norm(v) === want) ??
        voices.find((v) => norm(v).startsWith('zh')) ??
        null
      )
    },
    [voices],
  )

  const speakFrom = useCallback(
    (offset: number) => {
      if (!isSupported || !text) return
      const synth = window.speechSynthesis
      stoppingRef.current = true
      synth.cancel()
      stoppingRef.current = false

      baseOffsetRef.current = offset
      const utter = new SpeechSynthesisUtterance(text.slice(offset))
      utter.lang = lang
      const voice = pickVoice(lang)
      if (voice) utter.voice = voice
      utter.rate = rate
      utter.onboundary = (e) => {
        setProgress(Math.min(1, (baseOffsetRef.current + e.charIndex) / text.length))
      }
      utter.onend = () => {
        if (stoppingRef.current) return
        if (autoLoop) {
          setProgress(0)
          speakFromRef.current(0)
        } else {
          setSpeaking(false)
          setProgress(1)
        }
      }
      setSpeaking(true)
      synth.speak(utter)
    },
    [text, lang, autoLoop, rate, pickVoice],
  )

  // Keep the recursion ref pointing at the latest speakFrom (effect, not a render-time write).
  useEffect(() => {
    speakFromRef.current = speakFrom
  }, [speakFrom])

  const play = useCallback(() => {
    const len = text.length
    // Resume from the current marker; from the top once finished (progress = 1) or reset.
    const offset = progress > 0 && progress < 1 ? Math.floor(progress * len) : 0
    speakFrom(offset)
  }, [text, progress, speakFrom])

  const stop = useCallback(() => {
    if (!isSupported) return
    stoppingRef.current = true
    window.speechSynthesis.cancel()
    setSpeaking(false)
    setProgress(0)
  }, [])

  const seek = useCallback(
    (fraction: number) => {
      const f = Math.max(0, Math.min(1, fraction))
      if (speaking) speakFrom(Math.floor(f * text.length))
      else setProgress(f)
    },
    [speaking, speakFrom, text],
  )

  const voiceAvailable =
    isSupported &&
    voices.some((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())

  return { supported: isSupported, voiceAvailable, speaking, progress, play, stop, seek }
}
