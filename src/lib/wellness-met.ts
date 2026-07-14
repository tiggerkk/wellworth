/**
 * Activity-energy calculations (docs/02-tech-spec.md). MET values come from the activity's
 * `met_by_effort` map; the session's chosen effort selects which one applies.
 */

/** Resolve the MET value for a session's effort level, or undefined if not present. */
export function resolveMet(
  metByEffort: Record<string, number>,
  effort: string,
): number | undefined {
  return metByEffort[effort]
}

export interface ActivityEnergyInput {
  met: number
  weightKg: number
  minutes: number
}

/**
 * Energy burned = MET × body-weight(kg) × hours, as a positive magnitude. Callers store
 * activity diary entries with a negated `energy_kcal`.
 */
export function activityEnergyKcal({
  met,
  weightKg,
  minutes,
}: ActivityEnergyInput): number {
  return met * weightKg * (minutes / 60)
}
