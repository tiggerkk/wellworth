/**
 * Standardized 2-line food identity block — reused by the Wellness Diary Food Picker list and the
 * Wellness Library's Foods tab. Presentational only; each caller supplies its own nutrient count
 * and serving text (basis lookups differ for saved local foods vs. not-yet-saved USDA/OFF search
 * results), but the composition and ordering stay identical everywhere a food row is shown.
 *
 * Line 1: Food name · Supplement pill icon (if type is 'supplement')
 * Line 2: Source (USDA/OFF/Custom) · Nutrient count · Serving
 */
import { IconPill } from '@tabler/icons-react'
import { FOOD_SOURCES, type FoodSource, type FoodType } from '../constants/wellness'

type FoodRowHeaderProps = {
  name: string
  source: FoodSource
  nutrientCount: number
  serving: string
  /** Supplement rows get a purple pill icon next to the name. Omit for plain foods and for
   * not-yet-saved USDA/OFF search results, which have no type until they're saved. */
  type?: FoodType
}

const SOURCE_LABEL: Record<FoodSource, string> = Object.fromEntries(
  FOOD_SOURCES.map((s) => [s.key, s.label]),
) as Record<FoodSource, string>

/** Presentational: renders the 2 lines only. Each caller wraps this in its own sizing element
 * (a `min-w-0 flex-1` span) so truncation is governed by the caller's layout, not this component. */
export function FoodRowHeader({
  name,
  source,
  nutrientCount,
  serving,
  type,
}: FoodRowHeaderProps) {
  return (
    <>
      <span className="flex items-center gap-1.5 text-body text-text-primary">
        <span className="min-w-0 truncate">{name}</span>
        {type === 'supplement' && (
          <IconPill size={14} className="shrink-0 text-cat-supplement" />
        )}
      </span>
      <span className="block truncate text-caption text-text-secondary">
        {SOURCE_LABEL[source]} · {nutrientCount} nutrients · {serving}
      </span>
    </>
  )
}
