import { useNavigate } from 'react-router'
import { IconChevronLeft, IconChevronRight, IconUpload } from '@tabler/icons-react'
import { SectionCard } from '../components/SectionCard'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { routes } from '../constants/routes'

/**
 * Travel Settings. M5 adds the **Expense Categories** editor (Quotes pattern). The CSV importers
 * (M6 Expenses, M7 Itinerary) land in their milestones. Per-trip FX overrides live in the trip's
 * Expenses tab (where they're actionable), not here.
 */
export function TravelSettings() {
  const navigate = useNavigate()
  const openSheet = useSheetNavigate()

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <header className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="text-text-secondary"
        >
          <IconChevronLeft size={22} />
        </button>
        <h1 className="text-lg font-medium text-text-primary">Travel Settings</h1>
      </header>

      <SectionCard title="Expenses">
        <button
          onClick={() => openSheet(routes.travel.settingsCategories)}
          className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-input/40"
        >
          <span className="text-[15px] text-text-primary">Expense Categories</span>
          <IconChevronRight size={18} className="text-text-secondary" />
        </button>
      </SectionCard>

      <SectionCard title="Import">
        <button
          onClick={() => openSheet(routes.travel.importTrips)}
          className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-[15px] text-accent last:border-b-0 active:bg-input/40"
        >
          <IconUpload size={18} /> Import JSON Trips
        </button>
        <button
          onClick={() => openSheet(routes.travel.importExpenses)}
          className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-[15px] text-accent last:border-b-0 active:bg-input/40"
        >
          <IconUpload size={18} /> Import CSV Expenses
        </button>
      </SectionCard>
    </div>
  )
}
