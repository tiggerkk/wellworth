import { supabase } from '../lib/supabase'
import type { Tables, TablesUpdate } from '../types/database'
import { MEMBER_PROFILE_SEED, OWNER_PROFILE_SEED } from '../constants/profile-defaults'
import { ALLOWED_EMAILS, OWNER_EMAIL, isOwnerEmail } from '../lib/access'
import { getDefaultVisibleNutrientKeys } from './nutrient'
import { defaultTrackedTestKeys } from '../lib/medical'

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
 * Create a user's profile on first login. No-op if a profile already exists.
 *
 * The owner (per `isOwnerEmail`) gets the fully-populated OWNER_PROFILE_SEED and is stamped
 * `onboarded_at` so they skip the wizard; every other member gets the neutral MEMBER_PROFILE_SEED
 * with `onboarded_at` left null, which forces them through onboarding to enter their own body
 * metrics (they never inherit the owner's).
 *
 * The upsert uses onConflict 'user_id' + ignoreDuplicates so a concurrent call (e.g. React
 * StrictMode's double-invoke) can't insert twice and never overwrites an edited profile on later
 * logins. We check existence first to avoid the nutrient lookup on every sign-in.
 */
export async function ensureOwnerProfile(
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  const existing = await getProfile(userId)
  if (existing) return false

  const isOwner = isOwnerEmail(email, OWNER_EMAIL, ALLOWED_EMAILS)
  const visibleNutrients = await getDefaultVisibleNutrientKeys()

  const { error } = await supabase.from('profile').upsert(
    {
      user_id: userId,
      ...(isOwner
        ? { ...OWNER_PROFILE_SEED, onboarded_at: new Date().toISOString() }
        : MEMBER_PROFILE_SEED),
      visible_nutrients: visibleNutrients,
      // Seed the Medical Dashboard's tracked tests from the reference `default_tracked` set, the
      // same way visible_nutrients is seeded (the picker can trim it afterwards).
      medical_tracked_tests: defaultTrackedTestKeys(),
    },
    { onConflict: 'user_id', ignoreDuplicates: true },
  )
  if (error) throw error
  return true
}

/** Update the signed-in user's profile (Settings edits). Returns the updated row. */
export async function updateProfile(
  userId: string,
  patch: TablesUpdate<'profile'>,
): Promise<Tables<'profile'>> {
  const { data, error } = await supabase
    .from('profile')
    .update(patch)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}
