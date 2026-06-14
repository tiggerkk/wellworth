import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

/** Outline secondary action (e.g. RESET). Clearly muted + non-interactive when disabled. */
export function SecondaryButton({
  children,
  className = '',
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-pill border border-border bg-surface-alt px-5 py-3 text-sm font-medium text-text-secondary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
