import type { ReactNode } from 'react'

interface SectionCardProps {
  children: ReactNode
  /** Optional uppercase section label above the card. */
  title?: string
  className?: string
}

/** A `surface` rounded container; rows inside divide with hairline borders. */
export function SectionCard({ children, title, className = '' }: SectionCardProps) {
  return (
    <section className={className}>
      {title && (
        <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {children}
      </div>
    </section>
  )
}
