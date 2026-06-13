import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import { OWNER_PROFILE_SEED } from '../constants/profile-defaults'
import { getDefaultVisibleNutrientKeys } from './nutrient'

export async function getProfile(userId: string): Promise<Tables<'profile'> | null> {
  const { data, error } = await supabase
    .from('profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Create the owner's profile on first login. No-op if a profile already exists.
 *
 * The upsert uses onConflict 'user_id' + ignoreDuplicates so a concurrent call (e.g.
 * React StrictMode's double-invoke) can't insert twice and never overwrites an edited
 * profile on later logins. We check existence first to avoid the nutrient lookup on
 * every sign-in. See OWNER_PROFILE_SEED for the Phase-1 single-user assumption and the
 * documented multi-user change.
 */
export async function ensureOwnerProfile(userId: string): Promise<void> {
  const existing = await getProfile(userId)
  if (existing) return

  const visibleNutrients = await getDefaultVisibleNutrientKeys()

  const { error } = await supabase
    .from('profile')
    .upsert(
      { user_id: userId, ...OWNER_PROFILE_SEED, visible_nutrients: visibleNutrients },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )
  if (error) throw error
}
