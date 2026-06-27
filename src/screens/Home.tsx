import { Link } from 'react-router'
import { IconChevronRight, IconSettings } from '@tabler/icons-react'
import { routes } from '../constants/routes'
import { useProfile } from '../hooks/useProfile'
import { homeModules } from '../lib/modules-display'

/**
 * The Home hub: a launcher of module cards. Selecting a module enters it (its own
 * bottom-nav tabs take over). Global Settings is reached from the gear here.
 * Adding a module = adding a `ModuleDef` to `MODULES` — this screen needs no change.
 *
 * The card list is filtered + ordered per-profile (Global Settings → Display → Visible Modules):
 * while the profile loads (or fails) it falls back to all modules in canonical order, so the hub
 * never flashes empty. Hiding only removes the card — module routes stay reachable by direct URL.
 */
export function Home() {
  const { data: profile } = useProfile()
  const modules = homeModules(profile?.module_order, profile?.visible_modules)

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-text-primary">WellWorth</h1>
        <Link
          to={routes.settings}
          aria-label="Settings"
          className="p-1 text-text-secondary"
        >
          <IconSettings size={22} />
        </Link>
      </header>

      <div className="flex flex-col gap-3">
        {modules.map((m) => (
          <Link
            key={m.key}
            to={m.base}
            className="flex items-center gap-4 rounded-card border border-border bg-surface px-4 py-4 active:bg-input/40"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-input text-accent">
              <m.Icon size={24} stroke={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-text-primary">
                {m.label}
              </span>
              <span className="block text-xs text-text-secondary">{m.description}</span>
            </span>
            <IconChevronRight size={18} className="shrink-0 text-text-tertiary" />
          </Link>
        ))}
      </div>
    </div>
  )
}
