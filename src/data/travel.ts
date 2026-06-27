/**
 * Travel data-access layer — the only place Travel touches Supabase. Components call these; they never
 * embed SQL. user_id is passed in by the caller (from the auth session), matching the other modules.
 *
 * Hard delete throughout: deleting a trip cascades its days → stops and its expenses (FK ON DELETE
 * CASCADE); deleting a day cascades its stops. Trip start/end dates are cached from the days via
 * `recomputeTripDates`, called after any day-date change.
 */
import { supabase } from '../lib/supabase'
import type {
  RememberedCityRow,
  StopInsert,
  StopRow,
  StopUpdate,
  TripBundle,
  TripDayInsert,
  TripDayRow,
  TripDayUpdate,
  TripInsert,
  TripRow,
  TripUpdate,
} from '../lib/travel'
import type { ResolvedCity } from '../lib/travel'
import type { ExpenseInsert, ExpenseRow, ExpenseUpdate } from '../lib/expenses'

// --- Trips ---

export async function listTrips(userId: string): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from('trip')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getTrip(id: string): Promise<TripRow | null> {
  const { data, error } = await supabase
    .from('trip')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createTrip(input: TripInsert): Promise<TripRow> {
  const { data, error } = await supabase.from('trip').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateTrip(id: string, patch: TripUpdate): Promise<void> {
  const { error } = await supabase.from('trip').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from('trip').delete().eq('id', id)
  if (error) throw error
}

// --- Days ---

export async function createDay(input: TripDayInsert): Promise<TripDayRow> {
  const { data, error } = await supabase.from('trip_day').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateDay(id: string, patch: TripDayUpdate): Promise<void> {
  const { error } = await supabase.from('trip_day').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteDay(id: string): Promise<void> {
  const { error } = await supabase.from('trip_day').delete().eq('id', id)
  if (error) throw error
}

/** Persist a new day order (sort_order = array index). */
export async function reorderDays(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, i) => updateDay(id, { sort_order: i })))
}

// --- Stops ---

export async function createStop(input: StopInsert): Promise<StopRow> {
  const { data, error } = await supabase.from('stop').insert(input).select().single()
  if (error) throw error
  return data
}

/** Bulk-insert stops in one round-trip (duplicating a day), returning the created rows. Order isn't
 * guaranteed by the API, but each carries its own `sort_order`, so callers re-sort by that. */
export async function createStops(inputs: StopInsert[]): Promise<StopRow[]> {
  if (inputs.length === 0) return []
  const { data, error } = await supabase.from('stop').insert(inputs).select()
  if (error) throw error
  return data ?? []
}

export async function updateStop(id: string, patch: StopUpdate): Promise<void> {
  const { error } = await supabase.from('stop').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteStop(id: string): Promise<void> {
  const { error } = await supabase.from('stop').delete().eq('id', id)
  if (error) throw error
}

/** Persist a new stop order within one day (sort_order = array index). */
export async function reorderStops(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, i) => updateStop(id, { sort_order: i })))
}

/** The next append position (max sort_order + 1) for a day's stops; 0 when the day is empty. */
export async function nextStopSortOrder(dayId: string): Promise<number> {
  const { data, error } = await supabase
    .from('stop')
    .select('sort_order')
    .eq('trip_day_id', dayId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? data.sort_order + 1 : 0
}

// --- Bundle + derived ---

/** Load a trip with its ordered days and all of their stops (the Trip Builder's single read). */
export async function getTripBundle(tripId: string): Promise<TripBundle | null> {
  const trip = await getTrip(tripId)
  if (!trip) return null
  const { data: days, error: daysErr } = await supabase
    .from('trip_day')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
  if (daysErr) throw daysErr
  const dayIds = (days ?? []).map((d) => d.id)
  let stops: StopRow[] = []
  if (dayIds.length > 0) {
    const { data: stopRows, error: stopsErr } = await supabase
      .from('stop')
      .select('*')
      .in('trip_day_id', dayIds)
      .order('sort_order', { ascending: true })
    if (stopsErr) throw stopsErr
    stops = stopRows ?? []
  }
  return { trip, days: days ?? [], stops }
}

/** Load every trip's stops (city/country/province only) to build the Trips-list filter facets. */
export async function listTripFacetRows(userId: string): Promise<
  {
    trip_id: string
    city: string | null
    country: string | null
    province: string | null
  }[]
> {
  // stop has no trip_id; join through trip_day for it. Filter on the stop's own user_id (RLS-aligned).
  const { data, error } = await supabase
    .from('stop')
    .select('city, country, province, trip_day!inner(trip_id)')
    .eq('user_id', userId)
  if (error) throw error
  type Row = {
    city: string | null
    country: string | null
    province: string | null
    trip_day: { trip_id: string } | { trip_id: string }[]
  }
  return ((data ?? []) as Row[]).map((r) => {
    const td = Array.isArray(r.trip_day) ? r.trip_day[0] : r.trip_day
    return {
      trip_id: td?.trip_id ?? '',
      city: r.city,
      country: r.country,
      province: r.province,
    }
  })
}

/** Recache trip.start_date / end_date from the min/max non-null day_date (null when no dated days). */
export async function recomputeTripDates(tripId: string): Promise<void> {
  const { data, error } = await supabase
    .from('trip_day')
    .select('day_date')
    .eq('trip_id', tripId)
    .not('day_date', 'is', null)
    .order('day_date', { ascending: true })
  if (error) throw error
  const dates = (data ?? []).map((d) => d.day_date).filter((d): d is string => d != null)
  const start_date = dates[0] ?? null
  const end_date = dates[dates.length - 1] ?? null
  await updateTrip(tripId, { start_date, end_date })
}

// --- Expenses ---

export async function listExpenses(tripId: string): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from('trip_expense')
    .select('*')
    .eq('trip_id', tripId)
    .order('expense_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createExpense(input: ExpenseInsert): Promise<ExpenseRow> {
  const { data, error } = await supabase
    .from('trip_expense')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateExpense(id: string, patch: ExpenseUpdate): Promise<void> {
  const { error } = await supabase.from('trip_expense').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('trip_expense').delete().eq('id', id)
  if (error) throw error
}

/** Delete all of a trip's expenses (the importer's "replace existing expenses for this trip" option). */
export async function deleteExpensesForTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from('trip_expense').delete().eq('trip_id', tripId)
  if (error) throw error
}

/** How many of the owner's expenses use a category key — gates that category's deletion. */
export async function countExpensesByCategory(
  userId: string,
  key: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('trip_expense')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', key)
  if (error) throw error
  return count ?? 0
}

/** Bulk-move expenses from one category key to another before the source key is deleted. */
export async function reassignExpenseCategory(
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<void> {
  const { error } = await supabase
    .from('trip_expense')
    .update({ category: toKey })
    .eq('user_id', userId)
    .eq('category', fromKey)
  if (error) throw error
}

// --- Remembered cities ---

export async function listRememberedCities(userId: string): Promise<RememberedCityRow[]> {
  const { data, error } = await supabase
    .from('remembered_city')
    .select('*')
    .eq('user_id', userId)
    .order('city', { ascending: true })
  if (error) throw error
  return data
}

/**
 * Cache (create-or-replace) a resolved city for this owner, keyed on the normalized name (city_norm).
 * Returns the stored row. Used whenever the picker confirms a city so it resolves from cache next time.
 */
export async function rememberCity(
  userId: string,
  city: ResolvedCity,
): Promise<RememberedCityRow> {
  const { data, error } = await supabase
    .from('remembered_city')
    .upsert(
      {
        user_id: userId,
        city: city.city,
        country: city.country,
        province: city.province,
        lat: city.lat,
        lng: city.lng,
      },
      { onConflict: 'user_id,city_norm' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}
