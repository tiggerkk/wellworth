import { useState } from 'react'
import { IconCalendar, IconTrash, IconX } from '@tabler/icons-react'
import { SelectMenu } from './SelectMenu'
import { PrimaryButton } from './PrimaryButton'
import { Calendar } from './Calendar'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { createExpense, updateExpense } from '../data/travel'
import { evalReimbursement, REIMBURSE_PRESETS } from '../lib/reimburse'
import { formatMoney, type ExpenseRow } from '../lib/expenses'
import type { TravelCategoryConfig } from '../lib/travel-config'
import { CURRENCIES } from '../constants/travel'
import { formatFullDate, todayLocal } from '../lib/date'

interface ExpenseEditorSheetProps {
  userId: string
  tripId: string
  defaultCurrency: string
  categories: TravelCategoryConfig[]
  trackReimbursement: boolean
  expense?: ExpenseRow
  onClose: () => void
  /** Called with the created/updated row so the caller can merge it optimistically (no refetch). */
  onSaved: (expense: ExpenseRow) => void
  onDelete?: () => void
}

// Shared single-line field standard — see `.field-control` in index.css.
const inputClass = 'field-control w-full'

/** A **local** overlay editing one expense (not a route sheet, so the Builder draft survives). */
export function ExpenseEditorSheet({
  userId,
  tripId,
  defaultCurrency,
  categories,
  trackReimbursement,
  expense,
  onClose,
  onSaved,
  onDelete,
}: ExpenseEditorSheetProps) {
  useEscapeKey(onClose)
  const [saving, setSaving] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const [date, setDate] = useState<string | null>(expense?.expense_date ?? todayLocal())
  const [description, setDescription] = useState(expense?.description ?? '')
  const [category, setCategory] = useState(expense?.category ?? categories[0]?.key ?? '')
  const [cost, setCost] = useState(expense?.cost != null ? String(expense.cost) : '')
  const [currency, setCurrency] = useState(expense?.currency ?? defaultCurrency)
  const [formula, setFormula] = useState(expense?.reimbursed_formula ?? '')

  const costNum = Number(cost)
  const reimbursed =
    trackReimbursement && formula.trim() && Number.isFinite(costNum)
      ? evalReimbursement(formula, costNum)
      : null
  const net = Number.isFinite(costNum) ? costNum - (reimbursed ?? 0) : null

  const canSave =
    description.trim() !== '' &&
    cost.trim() !== '' &&
    Number.isFinite(costNum) &&
    category

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = {
        expense_date: date,
        description: description.trim(),
        category,
        cost: costNum,
        currency,
        reimbursed_formula: trackReimbursement && formula.trim() ? formula.trim() : null,
        reimbursed_amount: trackReimbursement ? reimbursed : null,
      }
      let saved: ExpenseRow
      if (expense) {
        await updateExpense(expense.id, payload)
        // The patch covers every edited field, so the merged row matches what the DB now holds.
        saved = { ...expense, ...payload }
      } else {
        saved = await createExpense({ ...payload, user_id: userId, trip_id: tripId })
      }
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={expense ? 'Edit expense' : 'Add expense'}
        className="absolute inset-0 flex flex-col bg-surface pt-[env(safe-area-inset-top)]"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={onClose} aria-label="Close" className="text-text-secondary">
            <IconX size={22} />
          </button>
          <h1 className="flex-1 text-heading font-medium text-text-primary">
            {expense ? 'Edit Expense' : 'Add Expense'}
          </h1>
          {expense && onDelete && (
            <button
              onClick={onDelete}
              aria-label="Delete expense"
              className="p-1 text-text-secondary"
            >
              <IconTrash size={20} />
            </button>
          )}
          <PrimaryButton
            size="sm"
            tone="positive"
            onClick={() => void save()}
            disabled={saving || !canSave}
          >
            {expense ? 'Save' : 'Add'}
          </PrimaryButton>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <button
            onClick={() => setDatePickerOpen(true)}
            className="field-control flex items-center justify-between text-left"
          >
            <span className="text-caption text-text-secondary">
              Date
              <span className="mt-0.5 block text-body text-text-primary">
                {date ? (
                  formatFullDate(date)
                ) : (
                  <span className="text-text-tertiary">No date</span>
                )}
              </span>
            </span>
            <IconCalendar size={18} className="shrink-0 text-text-secondary" />
          </button>

          <label className="text-caption text-text-secondary">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <div className="text-caption text-text-secondary">
            Category
            <div className="mt-1">
              <SelectMenu
                value={category}
                onChange={setCategory}
                ariaLabel="Category"
                options={categories.map((c) => ({ value: c.key, label: c.label }))}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 text-caption text-text-secondary">
              Cost
              <input
                type="number"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <div className="w-24 text-caption text-text-secondary">
              Currency
              <div className="mt-1">
                <SelectMenu
                  value={currency}
                  onChange={setCurrency}
                  ariaLabel="Currency"
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                />
              </div>
            </div>
          </div>

          {trackReimbursement && (
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-alt p-3">
              <label className="text-caption text-text-secondary">
                Reimbursed (number or formula on <code>amount</code>)
                <input
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="e.g. amount/2"
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {REIMBURSE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setFormula(p.formula)}
                    className="rounded-pill bg-input px-3 py-1 text-body text-text-primary"
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setFormula('')}
                  className="rounded-pill bg-input px-3 py-1 text-body text-text-secondary"
                >
                  None
                </button>
              </div>
              <p className="text-caption text-text-secondary">
                {formula.trim() && reimbursed == null ? (
                  <span className="text-danger">Invalid formula</span>
                ) : (
                  <>
                    Reimbursed{' '}
                    <span className="text-text-primary">
                      {formatMoney(reimbursed ?? 0, currency)}
                    </span>
                    {net != null && (
                      <>
                        {' · Net '}
                        <span className="text-text-primary">
                          {formatMoney(net, currency)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {datePickerOpen && (
        <Calendar
          day={date ?? todayLocal()}
          onSelect={(iso) => {
            setDate(iso)
            setDatePickerOpen(false)
          }}
          onClose={() => setDatePickerOpen(false)}
        />
      )}
    </div>
  )
}
