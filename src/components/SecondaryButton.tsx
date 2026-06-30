import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  /** 'default' = full pill; 'sm' = compact for header action bars. */
  size?: 'default' | 'sm'
}

const SIZE = { default: 'px-5 py-3', sm: 'px-3 py-1.5' } as const

/** Outline secondary action (e.g. RESET). Clearly muted + non-interactive when disabled. */
export function SecondaryButton({
  children,
  className = '',
  size = 'default',
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-pill border border-border bg-surface-alt ${SIZE[size]} text-body font-medium text-text-secondary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
