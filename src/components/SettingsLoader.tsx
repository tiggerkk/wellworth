import type { ReactNode } from 'react'
import { SettingsLayout } from './SettingsLayout'
import { EntryLoader } from './EntryLoader'

interface SettingsLoaderProps<T> {
  /** The Settings screen's title (see `SettingsLayout`). */
  title: string
  /** Overrides the close button's accessible name (e.g. the Literature module's 關閉). */
  closeLabel?: string
  /** True while the async load is in flight. */
  loading: boolean
  /** Truthy when the load failed. */
  error?: unknown
  /** The loaded value, or null/undefined when missing (treated as "not found"). */
  data: T | null | undefined
  /** Message shown on error / not-found. */
  errorText: ReactNode
  /** Renders the body once the data is present (narrowed to non-null). */
  children: (data: T) => ReactNode
}

/**
 * The shared shell for a Settings screen that loads the profile before showing its body:
 * `SettingsLayout` + `EntryLoader` (with the `className="contents"` every Settings screen already
 * used, since a plain scrolling page's body isn't a flex column the way a Sheet's is). Covers every
 * module Settings screen except `Settings` itself, whose `AccountCard` must stay usable even when
 * the profile fails to load (it's driven by the session, not the profile) — that one composes
 * `SettingsLayout` + `EntryLoader` directly instead.
 */
export function SettingsLoader<T>({
  title,
  closeLabel,
  loading,
  error,
  data,
  errorText,
  children,
}: SettingsLoaderProps<T>) {
  return (
    <SettingsLayout title={title} closeLabel={closeLabel}>
      <EntryLoader
        loading={loading}
        error={error}
        data={data}
        errorText={errorText}
        className="contents"
      >
        {children}
      </EntryLoader>
    </SettingsLayout>
  )
}
