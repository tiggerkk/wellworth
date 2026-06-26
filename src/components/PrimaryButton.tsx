import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  /** 'default' = full pill (sign-in, full-width); 'sm' = compact for header action bars. */
  size?: 'default' | 'sm'
  /** 'fill' = neutral light pill (default); 'positive' = teal, for Create / Add / Save actions. */
  tone?: 'fill' | 'positive'
}

const SIZE = { default: 'px-5 py-3', sm: 'px-3 py-1.5' } as const
const TONE = { fill: 'bg-fill', positive: 'bg-positive' } as const

/** The primary action button (e.g. Google sign-in, the top-right ADD / SAVE / CREATE actions):
 * a light `fill` pill on dark, or a teal `positive` pill for create/add/save. See
 * docs/01-design-system.md. */
export function PrimaryButton({
  children,
  className = '',
  size = 'default',
  tone = 'fill',
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-pill ${TONE[tone]} ${SIZE[size]} text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
