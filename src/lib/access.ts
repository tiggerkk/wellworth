/**
 * App-level access control: an optional email allowlist layered on top of Google sign-in + RLS.
 *
 * Google OAuth + Supabase will mint a session for *any* Google account once the consent screen is
 * published and sign-ups are enabled. RLS still isolates each user's rows, but a stranger could
 * create their own account and consume the project's quota. This allowlist closes that door at the
 * auth boundary: a session whose email isn't listed is signed straight back out (see
 * `AuthProvider`). It is config-driven via the build-time `VITE_ALLOWED_EMAILS` var.
 *
 * An empty / unset allowlist means **no restriction** (every authenticated account is allowed), so
 * local dev and a freshly cloned repo keep working until the owner opts in by setting the var.
 */

/** Parse the comma/whitespace-separated `VITE_ALLOWED_EMAILS` value into lowercased addresses. */
export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[\s,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Is `email` permitted to use the app? An **empty** allowlist allows everyone (no restriction);
 * otherwise the (case-insensitive) email must be on the list. A missing email is denied only when
 * the list is non-empty.
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  if (allowlist.length === 0) return true
  if (!email) return false
  return allowlist.includes(email.trim().toLowerCase())
}

/** The allowlist configured for this build (empty ⇒ no restriction). */
export const ALLOWED_EMAILS = parseAllowlist(import.meta.env.VITE_ALLOWED_EMAILS)

/** The owner's email for this build (`VITE_OWNER_EMAIL`), or undefined when unset. */
export const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL as string | undefined

/**
 * Is `email` the app **owner**? The owner keeps the seeded owner profile and skips onboarding;
 * everyone else gets neutral defaults and is forced through the first-run wizard.
 *
 * - If `ownerEmail` (`VITE_OWNER_EMAIL`) is set, the owner is exactly that address.
 * - If it's **unset** but the allowlist has a single entry, that lone account is the owner — this
 *   preserves the original single-user behavior without any extra config.
 * - Otherwise nobody is auto-owner (multi-member build with no explicit owner ⇒ everyone onboards).
 */
export function isOwnerEmail(
  email: string | null | undefined,
  ownerEmail: string | undefined,
  allowlist: string[],
): boolean {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) return false
  const owner = ownerEmail?.trim().toLowerCase()
  if (owner) return normalized === owner
  if (allowlist.length === 1) return normalized === allowlist[0]
  return false
}

/**
 * Does this profile still need first-run onboarding? True only for a real, loaded profile row whose
 * `onboarded_at` is null (a new member). A null/undefined profile means it's still loading or being
 * created, so we return false — the gate shows a splash rather than flashing the wizard.
 */
export function needsOnboarding(
  profile: { onboarded_at: string | null } | null | undefined,
): boolean {
  return !!profile && profile.onboarded_at == null
}

/**
 * Read an OAuth error the provider handed back on the redirect (e.g.
 * `?error=access_denied&error_code=signup_disabled&error_description=...`, in the query or the hash)
 * into a human message, or null when there's none. Surfaced on Login so a failed sign-in explains
 * itself instead of silently looping. `signup_disabled` is the common one after a DB reset wipes
 * `auth.users` while Supabase sign-ups are turned off (see OWNER-RUNBOOK Part H3 / M1).
 */
export function parseOAuthError(search: string, hash: string): string | null {
  const q = new URLSearchParams(search.replace(/^\?/, ''))
  const h = new URLSearchParams(hash.replace(/^#/, ''))
  const code = q.get('error_code') ?? h.get('error_code')
  const desc = q.get('error_description') ?? h.get('error_description')
  const err = q.get('error') ?? h.get('error')
  if (!code && !desc && !err) return null
  if (code === 'signup_disabled') {
    return 'New sign-ups are disabled for this app. Ask the owner to enable sign-ups in Supabase (then sign in again).'
  }
  return desc ?? err ?? 'Sign-in failed — please try again.'
}
