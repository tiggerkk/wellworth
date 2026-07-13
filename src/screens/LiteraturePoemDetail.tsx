import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconHeart, IconHeartFilled, IconX } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useLiteratureFavorites } from '../hooks/useLiteratureFavorites'
import { getPoem, loadMeta } from '../data/literature'
import { DYNASTY_CHIP, isFieldVisible, type SpeechLang } from '../lib/literature'
import { LITERATURE_SECTION_COLOR } from '../constants/literature'
import { routes } from '../constants/routes'
import { PoemReader } from '../components/PoemReader'
import { FilterPill } from '../components/FilterPill'
import { Collapsible } from '../components/Collapsible'

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

/** A prose (譯文/註釋/賞析) section body — only rendered when both visible and non-empty. */
function ProseSection({
  title,
  color,
  text,
}: {
  title: string
  color: string
  text: string
}) {
  if (!text) return null
  return (
    <Collapsible title={title} color={color} defaultOpen={false}>
      <p className="whitespace-pre-line px-4 py-3 text-body leading-relaxed text-text-secondary">
        {text}
      </p>
    </Collapsible>
  )
}

/**
 * Literature — Poem detail. Header carries the poem title (truncated) · writer · dynasty; body is the
 * read-aloud player (粵/國), the tag list, then collapsible color-accented sections: 原文 (always) ·
 * 譯文 / 註釋 / 賞析 (each gated by the Settings → 顯示 visibility prefs and shown only when present).
 * Keyed by route id so the reader resets per poem; Esc / X both close.
 */
export function LiteraturePoemDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const poemId = Number(id)
  const { favoriteIds, toggle } = useLiteratureFavorites()
  const { data: profile } = useProfile()
  useEscapeKey(() => navigate(-1))

  const fn = useCallback(() => getPoem(poemId), [poemId])
  const metaFn = useCallback(() => loadMeta(), [])
  const { data: poem, loading, error } = useAsync(fn)
  const { data: meta } = useAsync(metaFn)

  const defaultLang: SpeechLang =
    profile?.literature_tts_lang === 'zh-CN' ? 'zh-CN' : 'zh-HK'
  const autoLoop = profile?.literature_tts_autoloop ?? false
  const visibleFields = profile?.literature_poem_visible_fields ?? null

  const content = htmlToText(poem?.content)
  const isFav = favoriteIds.has(poemId)

  // Resolve the poem's tag names from the corpus meta (id → name), preserving meta's type order.
  const tags = useMemo(() => {
    if (!poem || !meta) return []
    const ids = new Set(poem.typeIds)
    return meta.types.filter((t) => ids.has(t.id)).map((t) => t.name)
  }, [poem, meta])

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 py-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-bg/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="關閉"
          className="-ml-1 shrink-0 p-1 text-text-secondary"
        >
          <IconX size={22} />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {poem && (
            <>
              <h1 className="min-w-0 truncate text-title font-medium text-text-primary">
                {poem.title}
              </h1>
              <button
                onClick={() => navigate(routes.literature.poet(String(poem.writerId)))}
                className="shrink-0 text-caption text-accent"
              >
                {poem.writer}
              </button>
              {poem.dynasty && (
                <span
                  className={`shrink-0 rounded-pill px-1.5 py-0.5 text-section ${DYNASTY_CHIP}`}
                >
                  {poem.dynasty}
                </span>
              )}
            </>
          )}
        </div>
        <button
          onClick={() => toggle(poemId)}
          aria-label="收藏"
          aria-pressed={isFav}
          className="shrink-0 p-1"
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

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((name) => (
                <FilterPill key={name} label={name} />
              ))}
            </div>
          )}

          <Collapsible
            title="原文"
            color={LITERATURE_SECTION_COLOR.content}
            defaultOpen={true}
          >
            <p className="whitespace-pre-line px-4 py-4 text-center text-xl leading-loose text-text-primary">
              {content}
            </p>
          </Collapsible>

          {isFieldVisible(visibleFields, 'translation') && (
            <ProseSection
              title="譯文"
              color={LITERATURE_SECTION_COLOR.translation}
              text={htmlToText(poem.translation)}
            />
          )}
          {isFieldVisible(visibleFields, 'remark') && (
            <ProseSection
              title="註釋"
              color={LITERATURE_SECTION_COLOR.remark}
              text={htmlToText(poem.remark)}
            />
          )}
          {isFieldVisible(visibleFields, 'shangxi') && (
            <ProseSection
              title="賞析"
              color={LITERATURE_SECTION_COLOR.shangxi}
              text={htmlToText(poem.shangxi)}
            />
          )}
        </>
      )}
    </div>
  )
}
