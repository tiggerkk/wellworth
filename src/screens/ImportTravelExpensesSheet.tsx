import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { SectionCard } from '../components/SectionCard'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../hooks/useProfile'
import {
  createExpense,
  createTrip,
  deleteExpensesForTrip,
  listTrips,
} from '../data/travel'
import { bumpTravel } from '../lib/travel-refresh'
import { errorMessage } from '../lib/errors'
import { effectiveCategories } from '../lib/travel-config'
import {
  buildExpenses,
  parseExpenseCsv,
  type ParsedExpenseCsv,
} from '../lib/travel-expense-import'

const MAX_WARNINGS = 15
const norm = (s: string) => s.trim().toLowerCase()

export function ImportTravelExpensesSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  const categories = useMemo(
    () => effectiveCategories(profile?.travel_expense_categories ?? null),
    [profile],
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedExpenseCsv | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{
    expenses: number
    trips: number
    created: number
  } | null>(null)

  const built = useMemo(
    () => (parsed ? buildExpenses(parsed, categories, mapping) : null),
    [parsed, categories, mapping],
  )

  async function onFile(file: File) {
    setError(null)
    setDone(null)
    setMapping({})
    try {
      const p = parseExpenseCsv(await file.text(), categories)
      setFileName(file.name)
      setParsed(p)
    } catch (e) {
      setParsed(null)
      setError(errorMessage(e, 'Could not read the file.'))
    }
  }

  async function runImport() {
    if (!userId || !built || built.expenses.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const existing = await listTrips(userId)
      const byName = new Map(existing.map((t) => [norm(t.name), t]))

      const groups = new Map<string, typeof built.expenses>()
      for (const e of built.expenses) {
        const arr = groups.get(e.tripName) ?? []
        arr.push(e)
        groups.set(e.tripName, arr)
      }

      let created = 0
      const replaced = new Set<string>()
      for (const [tripName, group] of groups) {
        let trip = byName.get(norm(tripName))
        if (!trip) {
          trip = await createTrip({
            user_id: userId,
            name: tripName,
            status: 'visited',
            base_currency: 'CNY',
          })
          byName.set(norm(tripName), trip)
          created += 1
        } else if (replaceExisting && !replaced.has(trip.id)) {
          await deleteExpensesForTrip(trip.id)
          replaced.add(trip.id)
        }
        for (const e of group) {
          await createExpense({
            user_id: userId,
            trip_id: trip.id,
            expense_date: e.expense_date,
            description: e.description,
            category: e.category,
            cost: e.cost,
            currency: trip.base_currency,
            reimbursed_formula: e.reimbursed_formula,
            reimbursed_amount: e.reimbursed_amount,
          })
        }
      }
      bumpTravel()
      setDone({ expenses: built.expenses.length, trips: groups.size, created })
    } catch (e) {
      setError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const count = built?.expenses.length ?? 0
  const tripsTouched = built?.byTrip.length ?? 0

  return (
    <Sheet variant="full" label="Import Expenses">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-heading font-medium text-text-primary">Import Expenses</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">
              Imported {done.expenses} expense{done.expenses === 1 ? '' : 's'} across{' '}
              {done.trips} trip{done.trips === 1 ? '' : 's'}
              {done.created > 0 &&
                ` (${done.created} new trip${done.created === 1 ? '' : 's'})`}
              .
            </p>
            <p className="text-body text-text-secondary">
              Amounts use each trip’s base currency — set the HKD rates in the trip’s
              Expenses tab.
            </p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload a wide CSV (
              <code className="text-text-primary">
                Trip, Date, Restaurant… Flight/Train, Cost, Re-imbursed
              </code>
              ). Each filled category column becomes an expense; rows attribute to trips
              by name (created if missing).
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-body text-text-primary"
            >
              <IconUpload size={18} />
              {fileName ? 'Choose a different file' : 'Choose CSV File'}
            </button>
            {fileName && (
              <p className="text-caption text-text-secondary">
                Selected: <span className="text-text-primary">{fileName}</span>
              </p>
            )}

            {parsed && parsed.errors.length > 0 && (
              <ul className="flex flex-col gap-1 text-caption text-danger">
                {parsed.errors.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}

            {parsed && parsed.errors.length === 0 && (
              <>
                <SectionCard title="Detected columns">
                  <p className="px-4 py-2 text-body text-text-secondary">
                    {[
                      parsed.tripCol != null && 'Trip',
                      parsed.dateCol != null && 'Date',
                      parsed.costCol != null && 'Cost',
                      parsed.reimbursedCol != null && 'Re-imbursed',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {' · '}
                    {parsed.categoryCols.length} category column
                    {parsed.categoryCols.length === 1 ? '' : 's'}
                  </p>
                </SectionCard>

                {parsed.unknownCols.length > 0 && (
                  <SectionCard title="Unknown columns — map or skip">
                    {parsed.unknownCols.map((u) => (
                      <div
                        key={u.header}
                        className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
                      >
                        <span className="truncate text-body text-text-primary">
                          {u.header}
                        </span>
                        <div className="w-40 shrink-0">
                          <SelectMenu
                            value={mapping[u.header] ?? ''}
                            onChange={(v) => setMapping((m) => ({ ...m, [u.header]: v }))}
                            ariaLabel={`Map ${u.header}`}
                            options={[
                              { value: '', label: 'Skip' },
                              ...categories.map((c) => ({
                                value: c.key,
                                label: c.label,
                              })),
                            ]}
                          />
                        </div>
                      </div>
                    ))}
                  </SectionCard>
                )}

                {built && (
                  <>
                    <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
                      Ready to import <strong>{count}</strong> expense
                      {count === 1 ? '' : 's'} across <strong>{tripsTouched}</strong> trip
                      {tripsTouched === 1 ? '' : 's'} (new trips created as needed).
                    </div>

                    <SectionCard title="By trip">
                      {built.byTrip.map((g) => (
                        <div
                          key={g.tripName}
                          className="flex items-center justify-between border-b border-border px-3 py-2 last:border-b-0 text-body"
                        >
                          <span className="truncate text-text-primary">{g.tripName}</span>
                          <span className="text-text-secondary">
                            {g.count} · {g.total.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </SectionCard>

                    <label className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
                      <span className="text-body text-text-primary">
                        Replace existing expenses for matched trips
                      </span>
                      <Toggle
                        checked={replaceExisting}
                        onChange={setReplaceExisting}
                        label="Replace existing expenses"
                      />
                    </label>

                    {built.warnings.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <p className="text-caption font-medium text-warning">
                          {built.warnings.length} note
                          {built.warnings.length === 1 ? '' : 's'}:
                        </p>
                        <ul className="flex flex-col gap-1 text-caption text-text-secondary">
                          {built.warnings.slice(0, MAX_WARNINGS).map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                          {built.warnings.length > MAX_WARNINGS && (
                            <li>…and {built.warnings.length - MAX_WARNINGS} more.</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {error && <p className="text-caption text-danger">{error}</p>}
          </>
        )}
      </div>

      <div className="border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {done !== null ? (
          <PrimaryButton onClick={() => navigate(-1)} className="w-full">
            DONE
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={() => void runImport()}
            disabled={importing || count === 0}
            className="w-full"
          >
            {importing
              ? 'Importing…'
              : count > 0
                ? `IMPORT ${count} EXPENSE${count === 1 ? '' : 'S'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>
    </Sheet>
  )
}
