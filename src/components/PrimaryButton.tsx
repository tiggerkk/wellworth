import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  /** 'default' = full pill (sign-in, full-width); 'sm' = compact for header action bars. */
  size?: 'default' | 'sm'
}

const SIZE = { default: 'px-5 py-3', sm: 'px-3 py-1.5' } as const

/** The light `fill` pill on dark — the primary action button (e.g. Google sign-in,
 * the top-right ADD / SAVE / CREATE actions). See docs/04-design-system.md. */
export function PrimaryButton({
  children,
  className = '',
  size = 'default',
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-pill bg-fill ${SIZE[size]} text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
