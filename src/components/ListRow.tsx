import type { ReactNode } from 'react'

interface ListRowProps {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
}

/** Leading icon · two-line title/subtitle · trailing value or control. */
export function ListRow({ leading, title, subtitle, trailing, onClick }: ListRowProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
        onClick ? 'active:bg-input/40' : ''
      }`}
    >
      {leading && <span className="shrink-0 text-text-secondary">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-text-primary">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-text-secondary">{subtitle}</span>
        )}
      </span>
      {trailing && <span className="shrink-0 text-text-muted">{trailing}</span>}
    </Tag>
  )
}
