import { IconStar, IconStarFilled, IconStarHalfFilled } from '@tabler/icons-react'

interface StarRatingProps {
  /** 0–5 in 0.5 steps. */
  value: number
  /** Omit for a read-only display; provide to make it an input. */
  onChange?: (value: number) => void
  size?: number
}

/**
 * 0–5 half-star rating, display + input. As an input each star has two half-width hit-zones
 * (left → x.5, right → x.0); tapping the current value clears it to 0. Filled/half = coral.
 */
export function StarRating({ value, onChange, size = 20 }: StarRatingProps) {
  const set = (v: number) => onChange?.(v === value ? 0 : v)

  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const icon =
          value >= i ? (
            <IconStarFilled size={size} className="text-accent" />
          ) : value >= i - 0.5 ? (
            <IconStarHalfFilled size={size} className="text-accent" />
          ) : (
            <IconStar size={size} className="text-text-tertiary" />
          )
        if (!onChange) return <span key={i}>{icon}</span>
        return (
          <span key={i} className="relative inline-flex">
            {icon}
            <button
              type="button"
              aria-label={`${i - 0.5} stars`}
              onClick={() => set(i - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              aria-label={`${i} stars`}
              onClick={() => set(i)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        )
      })}
    </span>
  )
}
