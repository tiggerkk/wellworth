import { Link } from 'react-router'
import { IconSettings } from '@tabler/icons-react'
import { routes } from '../constants/routes'
import { useProfile } from '../hooks/useProfile'
import { homeModules } from '../lib/modules-display'
import { BrandMark } from '../components/BrandMark'

/**
 * The Home hub: a launcher of module cards. Selecting a module enters it (its own
 * bottom-nav tabs take over). Global Settings is reached from the gear here.
 * Adding a module = adding a `ModuleDef` to `MODULES` — this screen needs no change.
 *
 * Cards are laid out in a 2-column grid that fills left→right, top→bottom, so their visual order
 * is exactly the linear `module_order`. Each card is a button-style link (no chevron).
 *
 * The card list is filtered + ordered per-profile (Global Settings → Display → Visible Modules).
 * `useProfile` seeds the first render from a local cache of the last-known profile, so the hub paints
 * the user's saved order/visibility immediately rather than flashing the canonical order (and never
 * flashes empty); on a fresh sign-in with no cache it falls back to all modules in canonical order.
 * Hiding only removes the card — module routes stay reachable by direct URL.
 */
export function Home() {
  const { data: profile } = useProfile()
  const modules = homeModules(profile?.module_order, profile?.visible_modules)

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrandMark className="size-7 text-accent" />
          <h1 className="text-title font-medium text-text-primary">WellWorth</h1>
        </div>
        <Link
          to={routes.settings}
          aria-label="Settings"
          className="p-1 text-text-secondary"
        >
          <IconSettings size={22} />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {modules.map((m) => (
          <Link
            key={m.key}
            to={m.base}
            className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface px-3 py-4 text-center active:bg-input/40"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-input text-accent">
              <m.Icon size={32} stroke={1.75} />
            </span>
            <span className="w-full min-w-0">
              <span className="block truncate text-body font-medium text-text-primary">
                {m.label}
              </span>
              <span className="block truncate text-caption text-text-secondary">
                {m.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
