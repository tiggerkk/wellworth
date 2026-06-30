import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconUser, IconX } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { getWriter, loadIndex } from '../data/literature'
import { DYNASTY_CHIP, isFieldVisible } from '../lib/literature'
import { LITERATURE_SECTION_COLOR } from '../constants/literature-sections'
import { routes } from '../constants/routes'
import { CollapsibleColorSection } from '../components/CollapsibleColorSection'

/** Writer portrait with a graceful fallback when `headImageUrl` is absent or dead. */
function Portrait({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <div className="flex size-24 items-center justify-center rounded-card bg-input">
        <IconUser size={40} className="text-text-tertiary" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-24 rounded-card object-cover"
    />
  )
}

/**
 * Literature — Poet detail. Name + dynasty in the header; portrait, then collapsible color-accented
 * 作者簡介 (bio, gated by the Settings → 顯示 prefs) and 作品 (works, always shown; links to the poem).
 */
export function LiteraturePoetDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const writerId = Number(id)
  const { data: profile } = useProfile()
  useEscapeKey(() => navigate(-1))

  const writerFn = useCallback(() => getWriter(writerId), [writerId])
  const indexFn = useCallback(() => loadIndex(), [])
  const { data: writer, loading, error } = useAsync(writerFn)
  const { data: index } = useAsync(indexFn)

  const works = useMemo(() => {
    if (!writer || !index) return []
    const byId = new Map(index.map((p) => [p.id, p]))
    return writer.poemIds.map((pid) => byId.get(pid)).filter((p) => p !== undefined)
  }, [writer, index])

  const bio = writer?.detailIntro || writer?.simpleIntro || ''
  const showBio = isFieldVisible(profile?.literature_writer_visible_fields ?? null, 'bio')

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 py-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-bg/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="關閉"
          className="-ml-1 p-1 text-text-secondary"
        >
          <IconX size={22} />
        </button>
        {writer && (
          <>
            <h1 className="text-title font-medium text-text-primary">{writer.name}</h1>
            {writer.dynasty && (
              <span className={`rounded-pill px-1.5 py-0.5 text-section ${DYNASTY_CHIP}`}>
                {writer.dynasty}
              </span>
            )}
          </>
        )}
      </header>

      {loading && <p className="text-body text-text-secondary">載入中…</p>}
      {error && <p className="text-body text-danger">無法載入此名家。</p>}

      {writer && (
        <>
          <div className="flex justify-center">
            <Portrait url={writer.headImageUrl} name={writer.name} />
          </div>

          {bio && showBio && (
            <CollapsibleColorSection
              title="作者簡介"
              color={LITERATURE_SECTION_COLOR.bio}
              defaultOpen={false}
            >
              <p className="whitespace-pre-line px-4 py-3 text-body leading-relaxed text-text-secondary">
                {bio}
              </p>
            </CollapsibleColorSection>
          )}

          {works.length > 0 && (
            <CollapsibleColorSection title="作品" color={LITERATURE_SECTION_COLOR.works}>
              {works.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(routes.literature.poem(String(p.id)))}
                  className="block w-full border-b border-border px-4 py-3 text-left text-body text-text-primary last:border-b-0"
                >
                  《{p.title}》
                </button>
              ))}
            </CollapsibleColorSection>
          )}
        </>
      )}
    </div>
  )
}
