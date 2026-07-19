/**
 * Standardized 2-line food identity block — reused by the Food Add sheet's picker list and the
 * Wellness Library's Foods tab. Presentational only; the caller supplies its own wrapping
 * element and the pre-composed secondary line, since the two screens describe a food row with
 * genuinely different data (the Library shows just its source/type tag; the Add sheet's search
 * results also carry a nutrient count and serving size, and include not-yet-saved USDA/OFF
 * results that don't have a source/type tag at all).
 *
 * Line 1: Food name
 * Line 2: Caller-supplied secondary text (may be empty)
 */
type FoodRowHeaderProps = {
  name: string
  secondary?: string
}

/** Presentational: renders the 2 lines only. Each caller wraps this in its own sizing element
 * (a `min-w-0 flex-1` span) so truncation is governed by the caller's layout, not this component. */
export function FoodRowHeader({ name, secondary }: FoodRowHeaderProps) {
  return (
    <>
      <span className="block truncate text-body text-text-primary">{name}</span>
      {secondary && (
        <span className="block truncate text-caption text-text-secondary">
          {secondary}
        </span>
      )}
    </>
  )
}
