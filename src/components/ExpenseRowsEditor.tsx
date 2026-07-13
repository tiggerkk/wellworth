import { useEffect, useRef, useState } from 'react'
import {
  IconCalendarEvent,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { SelectMenu } from './SelectMenu'
import { Calendar } from './Calendar'
import { REIMBURSE_PRESETS } from '../constants/travel'
import { evalReimbursement } from '../lib/travel-reimburse'
import {
  formatMoney,
  groupExpensesByDate,
  type ExpenseRow,
  type ExpenseUpdate,
} from '../lib/travel-expenses'
import type { TravelCategoryConfig } from '../lib/travel-config'
import { formatFullDate, todayLocal } from '../lib/date'

/** The four core fields captured for a new expense (date carried from the add row's chip). */
export interface ExpenseDraft {
  description: string
  category: string
  currency: string
  cost: number
  expense_date: string | null
}

interface ExpenseRowsEditorProps {
  /** The relevant expenses, already ordered by (expense_date, sort_order). */
  expenses: ExpenseRow[]
  /** Trip-level: render date-group headers and reorder within each group. Day modal: a single group. */
  groupByDate?: boolean
  categories: TravelCategoryConfig[]
  currencies: readonly string[]
  defaultCurrency: string
  /** New-row date default (day modal → the day's date; trip ledger → today). */
  defaultDate: string | null
  trackReimbursement: boolean
  onAdd: (draft: ExpenseDraft) => void
  onUpdate: (id: string, patch: ExpenseUpdate) => void
  onDelete: (id: string) => void
  /** New order of the ids within one date group. */
  onReorder: (orderedIds: string[]) => void
}

/**
 * Inline, spreadsheet-style expense editor shared by the Day modal and the trip-level Expenses ledger.
 * Fields in the owner's order: **Description · Category · Currency · Cost**. Each row is **always
 * stacked 2-line** (Description + expand on line 1; Category · Currency · Cost on line 2) so the four
 * fields never crowd into one line and over-truncate — at every Dynamic Type preset (F23). Each row
 * taps open to reveal Date · reorder · Reimbursed (when tracked) · Delete. A trailing add row commits
 * new expenses without a modal. Ordering/grouping is driven by the parent (this component is
 * `sort_order`-free); reorder is positional within a date group.
 */
export function ExpenseRowsEditor({
  expenses,
  groupByDate = false,
  categories,
  currencies,
  defaultCurrency,
  defaultDate,
  trackReimbursement,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: ExpenseRowsEditorProps) {
  // Group existing rows for display; the day modal is a single (header-less) group. Empty groups are
  // dropped — the add row below is the entry point when there's nothing yet.
  const groups = (
    groupByDate ? groupExpensesByDate(expenses) : [{ date: defaultDate, expenses }]
  ).filter((g) => g.expenses.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const ids = g.expenses.map((e) => e.id)
        return (
          <div key={g.date ?? '∅'} className="flex flex-col">
            {groupByDate && (
              <h4 className="px-1 pb-1 text-label font-medium text-text-secondary">
                {g.date ? formatFullDate(g.date) : 'No date'}
              </h4>
            )}
            <div className="divide-y divide-border rounded-card border border-border bg-surface">
              {g.expenses.map((e, i) => (
                <RowEditor
                  key={`${e.id}:${e.updated_at}`}
                  expense={e}
                  categories={categories}
                  currencies={currencies}
                  trackReimbursement={trackReimbursement}
                  canMoveUp={i > 0}
                  canMoveDown={i < ids.length - 1}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onMove={(dir) => {
                    const next = [...ids]
                    const j = i + dir
                    ;[next[i], next[j]] = [next[j]!, next[i]!]
                    onReorder(next)
                  }}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* One add row. A dashed border marks it as the entry affordance (not a saved expense); the
          trip ledger's date chip targets any (incl. new) date, the day modal fixes the date. */}
      <div className="rounded-card border border-dashed border-border bg-surface">
        <AddRow
          categories={categories}
          currencies={currencies}
          defaultCurrency={defaultCurrency}
          defaultDate={defaultDate}
          showDateChip={groupByDate}
          onAdd={onAdd}
        />
      </div>
    </div>
  )
}

// --- One existing expense row ---

function RowEditor({
  expense: e,
  categories,
  currencies,
  trackReimbursement,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onDelete,
  onMove,
}: {
  expense: ExpenseRow
  categories: TravelCategoryConfig[]
  currencies: readonly string[]
  trackReimbursement: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onUpdate: (id: string, patch: ExpenseUpdate) => void
  onDelete: (id: string) => void
  onMove: (dir: -1 | 1) => void
}) {
  const [open, setOpen] = useState(false)
  const [pickDate, setPickDate] = useState(false)
  const [description, setDescription] = useState(e.description)
  const [cost, setCost] = useState(String(e.cost))
  const [formula, setFormula] = useState(e.reimbursed_formula ?? '')

  function commitDescription() {
    const v = description.trim()
    if (v && v !== e.description) onUpdate(e.id, { description: v })
    else if (!v) setDescription(e.description)
  }
  function commitCost() {
    const n = Number(cost)
    if (cost.trim() && Number.isFinite(n) && n !== e.cost) onUpdate(e.id, { cost: n })
    else if (!cost.trim() || !Number.isFinite(n)) setCost(String(e.cost))
  }
  function setReimbursement(f: string) {
    setFormula(f)
    const amount = f.trim() ? evalReimbursement(f, e.cost) : null
    onUpdate(e.id, {
      reimbursed_formula: f.trim() || null,
      reimbursed_amount: amount,
    })
  }

  const descInput = (
    <input
      value={description}
      onChange={(ev) => setDescription(ev.target.value)}
      onBlur={commitDescription}
      aria-label="Description"
      className="field-control min-w-0 flex-1"
    />
  )
  const categorySelect = (
    <SelectMenu
      value={e.category}
      onChange={(v) => onUpdate(e.id, { category: v })}
      ariaLabel="Category"
      size="compact"
      options={categories.map((c) => ({ value: c.key, label: c.label }))}
    />
  )
  const currencySelect = (
    <SelectMenu
      value={e.currency}
      onChange={(v) => onUpdate(e.id, { currency: v })}
      ariaLabel="Currency"
      size="compact"
      options={currencies.map((c) => ({ value: c, label: c }))}
    />
  )
  const costInput = (
    <input
      type="number"
      inputMode="decimal"
      value={cost}
      onChange={(ev) => setCost(ev.target.value)}
      onBlur={commitCost}
      aria-label="Cost"
      className="field-control w-full text-right"
    />
  )
  const chevron = (
    <button
      onClick={() => setOpen((o) => !o)}
      aria-label={open ? 'Collapse expense details' : 'Expand expense details'}
      aria-expanded={open}
      className="shrink-0 p-0.5 text-text-tertiary"
    >
      {open ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
    </button>
  )

  return (
    <div className="px-3 py-2">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {descInput}
          {chevron}
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{categorySelect}</div>
          <div className="w-20 shrink-0">{currencySelect}</div>
          <div className="w-24 shrink-0">{costInput}</div>
        </div>
      </div>

      {open && (
        <div className="mt-2 flex flex-col gap-3 rounded-card bg-surface-alt p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-text-secondary">Date</span>
            <button
              onClick={() => setPickDate(true)}
              className="flex items-center gap-1 rounded-pill bg-input px-2.5 py-1 text-label"
            >
              <IconCalendarEvent size={15} className="shrink-0 text-text-secondary" />
              {e.expense_date ? (
                <span className="text-text-primary">
                  {formatFullDate(e.expense_date)}
                </span>
              ) : (
                <span className="text-text-tertiary">No date</span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-text-secondary">Order</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onMove(-1)}
                disabled={!canMoveUp}
                aria-label="Move expense up"
                className="rounded-input bg-input p-1 text-text-secondary disabled:opacity-40"
              >
                <IconChevronUp size={18} />
              </button>
              <button
                onClick={() => onMove(1)}
                disabled={!canMoveDown}
                aria-label="Move expense down"
                className="rounded-input bg-input p-1 text-text-secondary disabled:opacity-40"
              >
                <IconChevronDown size={18} />
              </button>
            </div>
          </div>

          {trackReimbursement && (
            <ReimbursementField
              formula={formula}
              cost={e.cost}
              currency={e.currency}
              onChange={setFormula}
              onCommit={setReimbursement}
            />
          )}

          <button
            onClick={() => onDelete(e.id)}
            className="inline-flex items-center gap-1 self-start text-label text-danger"
          >
            <IconTrash size={16} /> Delete
          </button>
        </div>
      )}

      {pickDate && (
        <Calendar
          day={e.expense_date ?? todayLocal()}
          onSelect={(iso) => {
            setPickDate(false)
            if (iso !== e.expense_date) onUpdate(e.id, { expense_date: iso })
          }}
          onClose={() => setPickDate(false)}
        />
      )}
    </div>
  )
}

// --- Trailing "add expense" row ---

function AddRow({
  categories,
  currencies,
  defaultCurrency,
  defaultDate,
  showDateChip,
  onAdd,
}: {
  categories: TravelCategoryConfig[]
  currencies: readonly string[]
  defaultCurrency: string
  defaultDate: string | null
  /** Day modal: the date is fixed by the day, so hide the chip; trip ledger: show it to pick a date. */
  showDateChip: boolean
  onAdd: (draft: ExpenseDraft) => void
}) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(categories[0]?.key ?? '')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [cost, setCost] = useState('')
  const [date, setDate] = useState<string | null>(defaultDate)
  const [pickDate, setPickDate] = useState(false)
  const descRef = useRef<HTMLInputElement>(null)

  // Cost is optional at add time — a blank cost commits as 0 so an expense can be jotted down by name
  // and priced later (the cost field stays editable inline). Only a description is required.
  const costNum = cost.trim() === '' ? 0 : Number(cost)
  const canAdd = description.trim() !== '' && Number.isFinite(costNum)
  // Until the user starts entering a row, dim the default category/currency/cost (+ date) line so the
  // add row reads as an entry affordance, not a saved expense.
  const active = description.trim() !== '' || cost.trim() !== ''

  /** Persist the draft if it's complete (description filled, cost valid-or-blank). Returns whether it
   *  committed — `commit` uses that to clear + refocus; the unmount flush ignores it. */
  function commitDraft() {
    if (!canAdd) return false
    onAdd({
      description: description.trim(),
      category,
      currency,
      cost: costNum,
      expense_date: date,
    })
    return true
  }

  function commit() {
    if (!commitDraft()) return
    setDescription('')
    setCost('')
    descRef.current?.focus()
  }

  // Auto-commit a complete draft when the editor is closed/unmounted before +/Enter is pressed
  // (e.g. closing the day modal or leaving the Expenses tab) — otherwise the typed-but-uncommitted
  // row was silently lost on close. A ref keeps the flush reading the latest draft/handler without
  // re-subscribing each keystroke; it no-ops on an empty/incomplete row (so a cleared add row, incl.
  // the dev StrictMode mount→cleanup, never double-saves).
  const flushRef = useRef(commitDraft)
  useEffect(() => {
    flushRef.current = commitDraft
  })
  useEffect(() => () => void flushRef.current(), [])

  const descInput = (
    <input
      ref={descRef}
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      placeholder="Add expense…"
      aria-label="New expense description"
      className="field-control min-w-0 flex-1"
    />
  )
  const categorySelect = (
    <SelectMenu
      value={category}
      onChange={setCategory}
      ariaLabel="New expense category"
      size="compact"
      options={categories.map((c) => ({ value: c.key, label: c.label }))}
    />
  )
  const currencySelect = (
    <SelectMenu
      value={currency}
      onChange={setCurrency}
      ariaLabel="New expense currency"
      size="compact"
      options={currencies.map((c) => ({ value: c, label: c }))}
    />
  )
  const costInput = (
    <input
      type="number"
      inputMode="decimal"
      value={cost}
      onChange={(e) => setCost(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      placeholder="0"
      aria-label="New expense cost"
      className="field-control w-full text-right"
    />
  )
  const addBtn = (
    <button
      onClick={commit}
      disabled={!canAdd}
      aria-label="Add expense"
      className="shrink-0 rounded-input bg-input p-1.5 text-positive disabled:opacity-40"
    >
      <IconPlus size={18} stroke={2.25} />
    </button>
  )
  const dateChip = showDateChip && (
    <button
      onClick={() => setPickDate(true)}
      className="flex items-center gap-1 rounded-pill bg-input px-2.5 py-1 text-label"
      aria-label="New expense date"
    >
      <IconCalendarEvent size={15} className="shrink-0 text-text-secondary" />
      {date ? (
        <span className="text-text-primary">{formatFullDate(date)}</span>
      ) : (
        <span className="text-text-tertiary">No date</span>
      )}
    </button>
  )

  return (
    <div className="bg-surface-alt/40 px-3 py-2">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {descInput}
          {addBtn}
        </div>
        <div
          className={`flex items-center gap-2 transition-opacity ${active ? '' : 'opacity-55'}`}
        >
          <div className="min-w-0 flex-1">{categorySelect}</div>
          <div className="w-20 shrink-0">{currencySelect}</div>
          <div className="w-24 shrink-0">{costInput}</div>
        </div>
        {dateChip && (
          <div className={`flex transition-opacity ${active ? '' : 'opacity-55'}`}>
            {dateChip}
          </div>
        )}
      </div>

      {pickDate && (
        <Calendar
          day={date ?? todayLocal()}
          onSelect={(iso) => {
            setDate(iso)
            setPickDate(false)
          }}
          onClose={() => setPickDate(false)}
        />
      )}
    </div>
  )
}

// --- Reimbursed (formula + presets + live net) ---

function ReimbursementField({
  formula,
  cost,
  currency,
  onChange,
  onCommit,
}: {
  formula: string
  cost: number
  currency: string
  onChange: (f: string) => void
  onCommit: (f: string) => void
}) {
  const reimbursed = formula.trim() ? evalReimbursement(formula, cost) : null
  const net = Number.isFinite(cost) ? cost - (reimbursed ?? 0) : null
  return (
    <div className="flex flex-col gap-2">
      <label className="text-caption text-text-secondary">
        Reimbursed (number or formula on <code>amount</code>)
        <input
          value={formula}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onCommit(formula)}
          placeholder="e.g. amount/2"
          className="field-control mt-1 w-full"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {REIMBURSE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onCommit(p.formula)}
            className="rounded-pill bg-input px-3 py-1 text-label text-text-primary"
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => onCommit('')}
          className="rounded-pill bg-input px-3 py-1 text-label text-text-secondary"
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
                <span className="text-text-primary">{formatMoney(net, currency)}</span>
              </>
            )}
          </>
        )}
      </p>
    </div>
  )
}
