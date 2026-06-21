/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_USDA_API_KEY: string
  readonly VITE_TMDB_API_KEY: string
  readonly VITE_GOOGLE_BOOKS_API_KEY?: string
  /** Comma/space-separated email allowlist; empty/unset ⇒ any signed-in account is allowed. */
  readonly VITE_ALLOWED_EMAILS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
