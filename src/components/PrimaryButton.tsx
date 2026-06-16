import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

/** The light `fill` pill on dark — the primary action button (e.g. Google sign-in,
 * the top-right ADD / SAVE / CREATE actions). See docs/04-design-system.md. */
export function PrimaryButton({
  children,
  className = '',
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-pill bg-fill px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
