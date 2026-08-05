import { useMemo } from 'react'
import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { asNutrientMap } from '../lib/wellness-nutrients'
import type { Tables } from '../types/database'

interface WellnessNutrientFoodsOverlayProps {
  /** The day's already-loaded diary entries (Diary's own `useAsync` result) — no extra fetch. */
  entries: Tables<'diary_entry'>[]
  nutrientKey: string
  label: string
  target: number | null
  unit: string
  onClose: () => void
}

function fmt(n: number): string {
  return Math.abs(n) >= 100 || Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(1)
}

/**
 * Local overlay opened from a Diary highlighted-nutrient bar: lists every logged item (food or
 * supplement — any diary_entry with a snapshot contribution for this nutrient, not just the
 * `breakfast`/`lunch`/`dinner`/`snacks` groups) that contributed to that nutrient on the viewed
 * day, descending by contributed amount. Reuses the Diary's already-fetched `entries`, so this
 * needs no network call of its own.
 */
export function WellnessNutrientFoodsOverlay({
  entries,
  nutrientKey,
  label,
  target,
  unit,
  onClose,
}: WellnessNutrientFoodsOverlayProps) {
  const rows = useMemo(() => {
    return entries
      .map((e) => ({ entry: e, amount: asNutrientMap(e.nutrients)[nutrientKey] }))
      .filter(
        (r): r is { entry: Tables<'diary_entry'>; amount: number } => r.amount != null,
      )
      .sort((a, b) => b.amount - a.amount)
  }, [entries, nutrientKey])

  return (
    <OverlayTop onClose={onClose} label={`${label} sources`}>
      <ScreenHeaderTitle onClose={onClose}>
        <h1 className="flex-1 truncate text-heading font-medium text-text-primary">
          {label}
          <span className="ml-1.5 font-normal text-text-secondary">
            {target != null && `${fmt(target)} `}
            {unit}
          </span>
        </h1>
      </ScreenHeaderTitle>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {rows.length === 0 ? (
          <p className="px-1 py-6 text-body text-text-tertiary">
            Nothing logged today contributes to this nutrient.
          </p>
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">
              <span className="min-w-0 flex-1">Food</span>
              <span className="w-14 shrink-0 text-right">Amount</span>
              <span className="w-20 shrink-0 text-right">{unit}</span>
            </div>
            <div className="divide-y divide-border">
              {rows.map(({ entry, amount }) => (
                <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                    {entry.label}
                  </span>
                  <span className="w-14 shrink-0 text-right text-body text-text-secondary">
                    {entry.amount != null ? fmt(entry.amount) : '—'}
                  </span>
                  <span className="w-20 shrink-0 text-right text-body text-text-secondary">
                    {fmt(amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </OverlayTop>
  )
}
