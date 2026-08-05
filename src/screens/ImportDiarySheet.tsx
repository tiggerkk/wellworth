import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload } from '@tabler/icons-react'
import { ImportSheetHeader } from '../components/ImportSheetHeader'
import { Sheet } from '../components/Sheet'
import { ImportSheetFooter } from '../components/ImportSheetFooter'
import { LabelChip } from '../components/LabelChip'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { DIARY_GROUPS } from '../constants/wellness'
import { listFoods } from '../data/food'
import { listActivities } from '../data/activity'
import { listDaysWithEntries, replaceDiaryDays } from '../data/diary-entry'
import { createSets } from '../data/strength-set'
import {
  buildDiaryEntryInsert,
  buildStrengthSetInserts,
  matchByName,
  parseDiaryJsonText,
  validateDiaryData,
  type ParsedDiaryDay,
} from '../lib/wellness-diary-import'
import { normMatch } from '../lib/title-match'
import { bumpDiary } from '../lib/wellness-diary-refresh'
import { errorMessage } from '../lib/errors'
import { formatFullDate } from '../lib/date'
import type { TablesInsert } from '../types/database'

const MAX_SAMPLE_DAYS = 15
const GROUP_LABEL = new Map(DIARY_GROUPS.map((g) => [g.key, g.label]))

interface Preview {
  days: ParsedDiaryDay[]
  replacedDays: number
  newDays: number
  entryCount: number
  linkedCount: number
  errors: string[]
}

/**
 * Diary — bulk JSON import (Wellness Settings, gated behind `food_importer_enabled` — the same
 * toggle Import/Export CSV Food uses). Shape: an array of `{day, entries}` — see
 * `wellness-diary-export.ts`'s header comment. A day is the unit of replacement: every day
 * present in the file has its existing entries deleted and replaced with the file's entries for
 * that day, so re-importing the same file is naturally idempotent (no per-entry dedup needed) —
 * see `data/diary-entry.ts`'s `replaceDiaryDays`.
 */
export function ImportDiarySheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  // Load the user's Food/Activity libraries once, for best-effort name linking.
  const libraryFn = useCallback(async () => {
    const [foods, activities] = await Promise.all([listFoods(), listActivities()])
    const foodByName = new Map(foods.map((f) => [normMatch(f.name), f.id]))
    const activityByName = new Map(activities.map((a) => [normMatch(a.name), a.id]))
    return { foodByName, activityByName }
  }, [])
  const { data: library, loading: libraryLoading } = useAsync(libraryFn)

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [done, setDone] = useState<{ days: number; entries: number } | null>(null)

  async function onFile(file: File) {
    setParseError(null)
    setImportError(null)
    setDone(null)
    setPreview(null)
    if (!userId || !library) return

    const text = await file.text()
    const parsed = parseDiaryJsonText(text)
    if (!parsed.ok) {
      setFileName(file.name)
      setParseError(parsed.error)
      return
    }
    const { days, errors } = validateDiaryData(parsed.data)
    const dayKeys = days.map((d) => d.day)
    let replacedDays: number
    try {
      const existing = await listDaysWithEntries(userId, dayKeys)
      replacedDays = dayKeys.filter((d) => existing.has(d)).length
    } catch (e) {
      setFileName(file.name)
      setParseError(errorMessage(e, 'Could not check your existing entries.'))
      return
    }

    let entryCount = 0
    let linkedCount = 0
    for (const day of days) {
      for (const entry of day.entries) {
        entryCount += 1
        const linked =
          entry.kind === 'food'
            ? matchByName(entry.label, library.foodByName)
            : matchByName(entry.label, library.activityByName)
        if (linked) linkedCount += 1
      }
    }

    setFileName(file.name)
    setPreview({
      days,
      replacedDays,
      newDays: days.length - replacedDays,
      entryCount,
      linkedCount,
      errors,
    })
  }

  async function runImport() {
    if (!userId || !preview || preview.days.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const dayKeys = preview.days.map((d) => d.day)

      // Flatten every day's entries into one insert batch, remembering which parsed entry each
      // insert row came from (by position) so strength sets can be attached after the insert
      // returns generated ids.
      const inserts: TablesInsert<'diary_entry'>[] = []
      const parsedByIndex: (typeof preview.days)[number]['entries'] = []
      for (const day of preview.days) {
        for (const entry of day.entries) {
          const foodId =
            entry.kind === 'food' && library
              ? matchByName(entry.label, library.foodByName)
              : null
          const activityId =
            entry.kind === 'activity' && library
              ? matchByName(entry.label, library.activityByName)
              : null
          const built = buildDiaryEntryInsert(day.day, entry, foodId, activityId)
          inserts.push({ ...built, user_id: userId })
          parsedByIndex.push(entry)
        }
      }

      const insertedRows = await replaceDiaryDays(userId, dayKeys, inserts)

      const setRows = insertedRows.flatMap((row, i) => {
        const entry = parsedByIndex[i]
        if (!entry || entry.kind !== 'activity' || entry.exercises.length === 0) return []
        return buildStrengthSetInserts(row.id, entry.exercises)
      })
      if (setRows.length > 0) await createSets(setRows)

      bumpDiary()
      setDone({ days: dayKeys.length, entries: inserts.length })
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const sample = useMemo(() => preview?.days.slice(0, MAX_SAMPLE_DAYS) ?? [], [preview])

  return (
    <Sheet variant="full" label="Import Diary">
      <ImportSheetHeader title="Import Diary" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">
              Imported {done.entries} entr{done.entries === 1 ? 'y' : 'ies'} across{' '}
              {done.days} day{done.days === 1 ? '' : 's'}.
            </p>
            <p className="text-body text-text-secondary">They’re in your Diary now.</p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload a JSON file (from Export JSON Diary, or matching its shape). Every
              day in the file has its existing entries fully replaced with the file's — so
              re-importing the same file is safe to repeat.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={libraryLoading}
              className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-body text-text-primary disabled:opacity-50"
            >
              <IconUpload size={18} />
              {libraryLoading
                ? 'Loading…'
                : fileName
                  ? 'Choose a different file'
                  : 'Choose JSON File'}
            </button>
            {fileName && (
              <p className="text-caption text-text-secondary">
                Selected: <span className="text-text-primary">{fileName}</span>
              </p>
            )}

            {parseError && <p className="text-caption text-danger">{parseError}</p>}

            {preview && (
              <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
                <strong>{preview.days.length}</strong> day
                {preview.days.length === 1 ? '' : 's'} —{' '}
                <strong>{preview.replacedDays}</strong> will be{' '}
                <span className="text-danger">replaced</span>,{' '}
                <strong>{preview.newDays}</strong> {preview.newDays === 1 ? 'is' : 'are'}{' '}
                new. <strong>{preview.entryCount}</strong> entr
                {preview.entryCount === 1 ? 'y' : 'ies'} total (
                <strong>{preview.linkedCount}</strong> linked to a food/activity).
                {preview.errors.length > 0 && (
                  <span className="text-text-secondary">
                    {' '}
                    {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'}{' '}
                    flagged.
                  </span>
                )}
              </div>
            )}

            {preview && preview.days.length > 0 && (
              <div className="shrink-0 overflow-hidden rounded-card border border-border bg-surface">
                {sample.map((d) => (
                  <div
                    key={d.day}
                    className="border-b border-border px-3 py-2.5 last:border-b-0"
                  >
                    <p className="flex items-center gap-2 text-body text-text-primary">
                      <LabelChip label={formatFullDate(d.day)} />
                      <span className="text-text-secondary">
                        {d.entries.length} entr{d.entries.length === 1 ? 'y' : 'ies'}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-caption text-text-secondary">
                      {d.entries
                        .map((e) => `${GROUP_LABEL.get(e.group) ?? e.group}: ${e.label}`)
                        .join(' · ')}
                    </p>
                  </div>
                ))}
                {preview.days.length > MAX_SAMPLE_DAYS && (
                  <p className="px-3 py-2 text-caption text-text-tertiary">
                    …and {preview.days.length - MAX_SAMPLE_DAYS} more day
                    {preview.days.length - MAX_SAMPLE_DAYS === 1 ? '' : 's'}.
                  </p>
                )}
              </div>
            )}

            {preview && preview.errors.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-medium text-danger">
                  {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'}{' '}
                  flagged:
                </p>
                <ul className="flex flex-col gap-1 text-caption text-danger">
                  {preview.errors.slice(0, MAX_SAMPLE_DAYS).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {preview.errors.length > MAX_SAMPLE_DAYS && (
                    <li>…and {preview.errors.length - MAX_SAMPLE_DAYS} more.</li>
                  )}
                </ul>
              </div>
            )}

            {importError && <p className="text-caption text-danger">{importError}</p>}
          </>
        )}
      </div>

      <ImportSheetFooter
        count={preview?.entryCount ?? 0}
        importing={importing}
        onSubmit={() => void runImport()}
        submitLabel={() =>
          `REPLACE ${preview?.replacedDays ?? 0} & ADD ${preview?.newDays ?? 0} DAY${
            (preview?.days.length ?? 0) === 1 ? '' : 'S'
          }`
        }
        done={done}
        onDone={() => navigate(-1)}
      />
    </Sheet>
  )
}
