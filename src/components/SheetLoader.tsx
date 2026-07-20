import type { ReactNode } from 'react'
import { Sheet } from './Sheet'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { EntryLoader } from './EntryLoader'

interface SheetLoaderProps<T> {
  /** The `Sheet`'s dialog `aria-label`. */
  label: string
  /** Header title (see `ScreenHeaderTitle`). */
  title: string
  /** Overrides the title's classes — e.g. `line-clamp-2 flex-1 ...` for a name that can wrap to
   *  two lines (a fund/policy/food name). */
  titleClassName?: string
  /** Trailing header content that does NOT depend on the loaded data (e.g. a "+ new" button).
   *  For actions that DO depend on the loaded data (an edit pencil, a favorite heart,
   *  `EntryHeaderActions`), don't use this — use the no-shift placeholder+float pattern instead
   *  (a reserved `actions` div here, the real actions absolutely positioned once loaded), matching
   *  every New/Edit form. */
  actions?: ReactNode
  /** `'back'` (default, a `<` chevron) for a sheet reached by drilling into it — every
   *  Settings-launched sheet and a Dashboard/Listing detail drill-in. `'close'` (an X) for a
   *  task-style picker opened over the current screen. See `ScreenHeaderTitle`'s `icon` prop. */
  icon?: 'close' | 'back'
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
 * The shared shell for a Sheet that loads a single thing before showing its body: `Sheet` +
 * `ScreenHeaderTitle` (always mounted, so the close button / title is visible from the very first
 * paint) + `EntryLoader` (Loading… / error / the body). Covers the ~15 Sheets whose header has no
 * load-dependent actions; Sheets with such actions (`WellnessActivitySheet`,
 * `InsurancePolicyDetailSheet`, etc.) compose `Sheet` + `ScreenHeaderTitle` + `EntryLoader`
 * directly so they can apply the placeholder+float technique.
 */
export function SheetLoader<T>({
  label,
  title,
  titleClassName,
  actions,
  icon = 'back',
  loading,
  error,
  data,
  errorText,
  children,
}: SheetLoaderProps<T>) {
  return (
    <Sheet variant="full" label={label}>
      <ScreenHeaderTitle
        title={title}
        titleClassName={titleClassName}
        actions={actions}
        icon={icon}
      />
      <EntryLoader loading={loading} error={error} data={data} errorText={errorText}>
        {children}
      </EntryLoader>
    </Sheet>
  )
}
