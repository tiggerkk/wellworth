import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { ExpenseRowsEditor, type ExpenseDraft } from './ExpenseRowsEditor'
import { useEscapeKey } from '../hooks/useEscapeKey'
import type { ExpenseRow, ExpenseUpdate } from '../lib/travel-expenses'
import type { TravelCategoryConfig } from '../lib/travel-config'
import { formatFullDate } from '../lib/date'

interface DayExpensesOverlayProps {
  dayLabel: string
  /** The day's date (drives the title + new-row default); null for an undated day. */
  date: string | null
  /** New-row date default — the day's date, or a trip-level fallback when the day is undated. */
  defaultDate: string | null
  /** This day's expenses (already filtered to `date` and ordered). */
  expenses: ExpenseRow[]
  categories: TravelCategoryConfig[]
  currencies: readonly string[]
  defaultCurrency: string
  trackReimbursement: boolean
  onAdd: (draft: ExpenseDraft) => void
  onUpdate: (id: string, patch: ExpenseUpdate) => void
  onDelete: (id: string) => void
  onReorder: (orderedIds: string[]) => void
  onClose: () => void
}

/**
 * A **local** overlay (not a route sheet, so the Builder draft survives) for logging the day's
 * expenses as they're incurred. Shows only the expenses whose `expense_date` matches the day; new
 * rows prefill that date. Expenses stay decoupled from stops — this is a date-matched convenience view.
 */
export function DayExpensesOverlay({
  dayLabel,
  date,
  defaultDate,
  expenses,
  categories,
  currencies,
  defaultCurrency,
  trackReimbursement,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onClose,
}: DayExpensesOverlayProps) {
  useEscapeKey(onClose)
  return (
    <OverlayTop onClose={onClose} label="Expenses for ${dayLabel}">
      <ScreenHeaderTitle onClose={onClose}>
        <div className="flex-1">
          <h1 className="text-heading font-medium text-text-primary">Expenses</h1>
          <p className="text-caption text-text-secondary">
            {dayLabel}
            {date ? ` · ${formatFullDate(date)}` : ''}
          </p>
        </div>
      </ScreenHeaderTitle>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ExpenseRowsEditor
          expenses={expenses}
          categories={categories}
          currencies={currencies}
          defaultCurrency={defaultCurrency}
          defaultDate={defaultDate}
          trackReimbursement={trackReimbursement}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      </div>
    </OverlayTop>
  )
}
