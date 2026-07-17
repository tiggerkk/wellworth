import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconUser } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { getWriter, loadIndex } from '../data/literature'
import { DYNASTY_CHIP, isFieldVisible } from '../lib/literature'
import { LITERATURE_SECTION_COLOR } from '../constants/literature'
import { routes } from '../constants/routes'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { Collapsible } from '../components/Collapsible'

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
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeaderTitle closeAriaLabel="關閉">
        {writer && (
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h1 className="min-w-0 truncate text-title font-medium text-text-primary">
              {writer.name}
            </h1>
            {writer.dynasty && (
              <span
                className={`shrink-0 rounded-pill px-1.5 py-0.5 text-section ${DYNASTY_CHIP}`}
              >
                {writer.dynasty}
              </span>
            )}
          </div>
        )}
      </ScreenHeaderTitle>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {loading && <p className="text-body text-text-secondary">載入中…</p>}
          {error && <p className="text-body text-danger">無法載入此名家。</p>}

          {writer && (
            <>
              <div className="flex justify-center">
                <Portrait url={writer.headImageUrl} name={writer.name} />
              </div>

              {bio && showBio && (
                <Collapsible
                  title="作者簡介"
                  color={LITERATURE_SECTION_COLOR.bio}
                  defaultOpen={false}
                >
                  <p className="whitespace-pre-line px-4 py-3 text-body leading-relaxed text-text-secondary">
                    {bio}
                  </p>
                </Collapsible>
              )}

              {works.length > 0 && (
                <Collapsible
                  title="作品"
                  color={LITERATURE_SECTION_COLOR.works}
                  defaultOpen={true}
                >
                  {works.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(routes.literature.poem(String(p.id)))}
                      className="block w-full border-b border-border px-4 py-3 text-left text-body text-text-primary last:border-b-0"
                    >
                      《{p.title}》
                    </button>
                  ))}
                </Collapsible>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
