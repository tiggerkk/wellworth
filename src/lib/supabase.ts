import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.',
  )
}

/**
 * The single Supabase client for the app. Uses the public anon key (RLS-respecting);
 * the service-role key must never appear in the client. This is the only module that
 * constructs the client — all DB access goes through the typed repositories in `src/data/*`.
 *
 * flowType 'pkce' is set explicitly: the bare supabase-js client defaults to 'implicit'.
 * PKCE is the secure choice for a SPA. detectSessionInUrl/persistSession/autoRefreshToken
 * are already the defaults but are stated here for clarity.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
