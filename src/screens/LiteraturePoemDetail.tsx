import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconChevronLeft, IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useLiteratureFavorites } from '../hooks/useLiteratureFavorites'
import { getPoem } from '../data/literature'
import { DYNASTY_CHIP, type SpeechLang } from '../lib/literature'
import { routes } from '../constants/routes'
import { SectionCard } from '../components/SectionCard'
import { PoemReader } from '../components/PoemReader'

/** Strip HTML to plain text, turning <br>/block-ends into newlines (poem fields may carry markup). */
function htmlToText(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function Prose({ title, text }: { title: string; text: string }) {
  if (!text) return null
  return (
    <SectionCard title={title}>
      <p className="whitespace-pre-line px-3 py-3 text-body leading-relaxed text-text-secondary">
        {text}
      </p>
    </SectionCard>
  )
}

/**
 * Literature — Poem detail. Read-aloud player (粵/國) over the poem text, the poem itself, then 譯文
 * (translation) / 註釋 (annotations) / 賞析 (appreciation). The poem body is loaded lazily from the
 * static corpus (runtime-cached); the screen is keyed by route id so the reader resets per poem.
 */
export function LiteraturePoemDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const poemId = Number(id)
  const { favoriteIds, toggle } = useLiteratureFavorites()
  const { data: profile } = useProfile()

  const fn = useCallback(() => getPoem(poemId), [poemId])
  const { data: poem, loading, error } = useAsync(fn)

  const defaultLang: SpeechLang =
    profile?.literature_tts_lang === 'zh-CN' ? 'zh-CN' : 'zh-HK'
  const autoLoop = profile?.literature_tts_autoloop ?? false

  const content = htmlToText(poem?.content)
  const isFav = favoriteIds.has(poemId)

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 py-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-bg/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="返回"
          className="-ml-1 p-1 text-text-secondary"
        >
          <IconChevronLeft size={22} />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => toggle(poemId)}
          aria-label="收藏"
          aria-pressed={isFav}
          className="p-1"
        >
          {isFav ? (
            <IconHeartFilled size={22} className="text-favorite" />
          ) : (
            <IconHeart size={22} className="text-text-tertiary" />
          )}
        </button>
      </header>

      {loading && <p className="text-body text-text-secondary">載入中…</p>}
      {error && <p className="text-body text-danger">無法載入此詩詞。</p>}

      {poem && (
        <>
          <PoemReader text={content} defaultLang={defaultLang} autoLoop={autoLoop} />

          <div className="flex flex-col items-center gap-1 rounded-card border border-border bg-surface-alt px-4 py-6">
            <h1 className="text-center text-xl font-medium text-text-primary">
              {poem.title}
            </h1>
            <p className="flex flex-wrap items-center justify-center gap-2 text-caption text-text-secondary">
              <button
                onClick={() => navigate(routes.literature.poet(String(poem.writerId)))}
                className="text-accent"
              >
                {poem.writer}
              </button>
              {poem.dynasty && (
                <span
                  className={`rounded-pill px-1.5 py-0.5 text-section ${DYNASTY_CHIP}`}
                >
                  {poem.dynasty}
                </span>
              )}
            </p>
            <p className="mt-3 whitespace-pre-line text-center text-lg leading-loose text-text-primary">
              {content}
            </p>
          </div>

          <Prose title="譯文" text={htmlToText(poem.translation)} />
          <Prose title="註釋" text={htmlToText(poem.remark)} />
          <Prose title="賞析" text={htmlToText(poem.shangxi)} />
        </>
      )}
    </div>
  )
}
