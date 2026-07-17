import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'

/**
 * The shared shell for a global/module Settings screen: a full-width column + sticky header with
 * the uniform top-left `IconX` dismiss (navigate(-1), also Esc-closable) and a title. The caller
 * supplies the body (its own loading/error/section content).
 * `closeLabel` overrides the button's accessible name (e.g. the Literature module's 關閉).
 */
export function SettingsLayout({
  title,
  closeLabel = 'Close',
  children,
}: {
  title: string
  closeLabel?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  useEscapeKey(() => navigate(-1))
  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <ScreenHeaderTitle
        title={title}
        closeAriaLabel={closeLabel}
        className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-bg/90 px-4 py-3 backdrop-blur"
        titleClassName="text-title font-medium text-text-primary"
      />
      {children}
    </div>
  )
}
