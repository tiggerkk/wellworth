import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  /** 'default' = full pill; 'sm' = compact for header action bars. */
  size?: 'default' | 'sm'
  /** 'neutral' (default) = muted text; 'accent' = blue-tinted text (e.g. a "Mark Matured" action). */
  tone?: 'neutral' | 'accent'
}

const SIZE = { default: 'px-5 py-3', sm: 'px-3 py-1.5' } as const
const TONE = { neutral: 'text-text-secondary', accent: 'text-accent' } as const

/** Outline secondary action (e.g. RESET). Clearly muted + non-interactive when disabled. */
export function SecondaryButton({
  children,
  className = '',
  size = 'default',
  tone = 'neutral',
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-pill border border-border bg-surface-alt ${SIZE[size]} text-body font-medium ${TONE[tone]} transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
