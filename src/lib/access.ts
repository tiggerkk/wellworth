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
