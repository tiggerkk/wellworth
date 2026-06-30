import { useEffect } from 'react'
import { useLocation, useOutlet, type Location } from 'react-router'
import { BottomNav } from './BottomNav'
import { MedicalLockProvider, useMedicalLock } from './MedicalLockProvider'
import { MedicalLockScreen } from './MedicalLockScreen'
import { Splash } from './Splash'
import { Toaster } from './Toaster'
import { useAuth } from '../auth/AuthProvider'
import { useEnsureProfile } from '../hooks/useEnsureProfile'
import { useProfile } from '../hooks/useProfile'
import { useFontSizeSync } from '../hooks/useFontSizeSync'
import { needsOnboarding } from '../lib/access'
import { moduleForPath } from '../constants/modules'
import { setLastModule } from '../lib/last-module'
import {
  BooksDashboard,
  BooksEntry,
  BooksLibrary,
  BooksSettings,
  Dashboard,
  Diary,
  Library,
  NetWorthDashboard,
  NetWorthEntry,
  Onboarding,
  QuotesEntry,
  QuotesLibrary,
  QuotesSettings,
  QuotesZen,
  Settings,
  TravelSettings,
  ShowsDashboard,
  ShowsEntry,
  ShowsLibrary,
  ShowsSettings,
  WellnessSettings,
} from '../screens'

// Background-location pattern (data-router): when a sheet route is open, `location.state
// .background` names the tab to keep painted behind it. We render that tab in <main> and
// the matched sheet (the Outlet) as an overlay on top. Keyed by the new namespaced paths.
const TAB_FOR_PATH: Record<string, React.ReactNode> = {
  '/wellness': <Diary />,
  '/wellness/dashboard': <Dashboard />,
  '/wellness/library': <Library />,
  '/wellness/settings': <WellnessSettings />,
  '/settings': <Settings />,
  '/networth': <NetWorthDashboard />,
  '/networth/entry': <NetWorthEntry />,
  '/shows': <ShowsDashboard />,
  '/shows/library': <ShowsLibrary />,
  '/shows/entry': <ShowsEntry />,
  '/shows/settings': <ShowsSettings />,
  '/books': <BooksDashboard />,
  '/books/library': <BooksLibrary />,
  '/books/entry': <BooksEntry />,
  '/books/settings': <BooksSettings />,
  '/quotes': <QuotesZen />,
  '/quotes/library': <QuotesLibrary />,
  '/quotes/entry': <QuotesEntry />,
  '/quotes/settings': <QuotesSettings />,
  '/travel/settings': <TravelSettings />,
}

export function AppShell() {
  const { session } = useAuth()
  useEnsureProfile(session)
  useFontSizeSync()

  const location = useLocation()
  const outlet = useOutlet()
  const module = moduleForPath(location.pathname)

  // Reopen the last-used module on next launch (Home hub + global settings are not modules).
  useEffect(() => {
    if (module) setLastModule(module.key)
  }, [module])

  const background = (location.state as { background?: Location } | null)?.background
  const backgroundTab = background ? (TAB_FOR_PATH[background.pathname] ?? null) : null

  return (
    <MedicalLockProvider>
      <div className="mx-auto flex h-dvh max-w-md flex-col bg-bg pt-[env(safe-area-inset-top)]">
        <main className="flex-1 overflow-y-auto">
          {background ? backgroundTab : outlet}
        </main>
        {module && <BottomNav module={module} />}
        {background && outlet}
        {/* Onboarding sits above the medical lock so a brand-new member fills in their profile
            before anything else (they can't have set a Medical PIN yet). */}
        <OnboardingGate />
        <MedicalLockGate />
        <Toaster />
      </div>
    </MedicalLockProvider>
  )
}

/**
 * Forces a new member through the first-run wizard. While the profile is still loading or being
 * created (`useEnsureProfile` is fire-and-forget, so getProfile returns null first) we show a splash
 * rather than flashing the wizard with empty fields; the owner / an already-onboarded member passes
 * straight through. Completing the wizard stamps `onboarded_at`, which flips `needsOnboarding`.
 */
function OnboardingGate() {
  const { data: profile, error } = useProfile()
  // On a profile fetch error we can't tell if onboarding is needed — don't hard-block behind a
  // splash; let the app render (its screens surface their own profile-load errors).
  if (error) return null
  // `profile == null` covers both the initial load (undefined) and the brief window where a new
  // member's row is still being created (getProfile resolves null). We gate on the resolved data,
  // NOT `loading`, because `loading` flips true on every background refetch (each bumpDiary) and
  // would otherwise flash this splash across the whole app. `data` is preserved across refetches.
  if (profile == null) {
    return (
      <div className="fixed inset-0 z-50 bg-bg">
        <Splash />
      </div>
    )
  }
  if (!needsOnboarding(profile)) return null
  return <Onboarding />
}

/** Covers the whole shell with the lock screen while the Medical module is locked. */
function MedicalLockGate() {
  const { locked, inMedical } = useMedicalLock()
  if (!locked || !inMedical) return null
  return <MedicalLockScreen />
}
