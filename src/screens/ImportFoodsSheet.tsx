import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconUpload } from '@tabler/icons-react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { ImportPreviewList } from '../components/ImportPreviewList'
import { FoodSearchOverlay } from '../components/FoodSearchOverlay'
import { useAuth } from '../auth/AuthProvider'
import { useNutrientReference } from '../hooks/useNutrientReference'
import { parseCsv } from '../lib/csv'
import {
  parseFoodCsv,
  type ImportFoodRecord,
  type ImportParseResult,
} from '../lib/wellness-food-import'
import {
  externalFoodServing,
  getUsdaFood,
  searchFoods,
  type ExternalFood,
} from '../lib/wellness-food-api'
import { foodMatchScore, foodMatchStatus } from '../lib/wellness-food-search'
import {
  getCachedFoodMatch,
  removeCachedFoodMatch,
  setCachedFoodMatch,
} from '../lib/wellness-food-match-cache'
import { saveImportedFoods } from '../data/food'
import { bumpDiary } from '../lib/wellness-diary-refresh'
import { errorMessage } from '../lib/errors'

const MAX_MESSAGES = 20
// USDA matching workers. USDA's free key allows ~1,000 req/hr and each `searchFoods` fires 2–4 calls,
// so keep the pool modest; the localStorage match cache covers re-imports of the same file.
const POOL = 6

interface ResolvedRow {
  input: ImportFoodRecord
  /** The resolved USDA food, or null → import as a custom food from the CSV. */
  match: ExternalFood | null
  // `manual` = the owner chose to import the CSV row as a custom food (no USDA link).
  status: 'ok' | 'review' | 'nomatch' | 'manual'
}

// Rows needing attention sort to the top of the preview (no-match first, then review); resolved rows
// (ok/manual) follow. Stable within a group. Frozen at resolve time so rows don't jump as they're fixed.
const STATUS_RANK: Record<ResolvedRow['status'], number> = {
  nomatch: 0,
  review: 1,
  ok: 2,
  manual: 2,
}

/** Best USDA hit for a CSV name: rank like the Add-Food list (name match, then richer food). */
function bestHit(
  results: ExternalFood[],
  name: string,
): { food: ExternalFood; score: number } | null {
  const ranked = results
    .map((food) => ({ food, score: foodMatchScore(food.name, name) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Object.keys(b.food.nutrients).length - Object.keys(a.food.nutrients).length,
    )
  return ranked[0] ?? null
}

async function resolveRow(input: ImportFoodRecord): Promise<ResolvedRow> {
  // is_custom rows are imported as custom foods straight from the CSV — no USDA/OFF lookup, no
  // review. (status 'manual' = custom, no external link; ranks with the resolved rows.)
  if (input.is_custom) return { input, match: null, status: 'manual' }
  // Cache hit → skip USDA entirely (instant re-imports after a DB reset). Status recomputed so it
  // stays consistent with the current CSV name.
  const cached = getCachedFoodMatch(input.name)
  if (cached) {
    return {
      input,
      match: cached,
      status: foodMatchStatus(foodMatchScore(cached.name, input.name)),
    }
  }
  try {
    const top = bestHit(await searchFoods(input.name), input.name)
    if (!top) return { input, match: null, status: 'nomatch' }
    // Fetch the full nutrient profile (search results are abbreviated) and cache it.
    const detail = await getUsdaFood(top.food.externalId)
    setCachedFoodMatch(input.name, detail)
    return { input, match: detail, status: foodMatchStatus(top.score) }
  } catch {
    return { input, match: null, status: 'nomatch' }
  }
}

/** Display info for a row's meta line — `{N} nutrients · {serving}` (USDA match or CSV custom). */
function rowMeta(r: ResolvedRow): { count: number; serving: string } {
  if (r.match) {
    return {
      count: Object.keys(r.match.nutrients).length,
      serving: externalFoodServing(r.match),
    }
  }
  return {
    count: Object.keys(r.input.nutrients).length,
    serving: r.input.nutrient_basis === 'per_serving' ? '1 serving' : '100 g',
  }
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

export function ImportFoodsSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { nutrients, loading: refLoading } = useNutrientReference()
  const knownKeys = useMemo(
    () => new Set((nutrients ?? []).map((n) => n.key)),
    [nutrients],
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ImportParseResult | null>(null)
  const [resolved, setResolved] = useState<ResolvedRow[] | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [fixIndex, setFixIndex] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null)

  async function onFile(file: File) {
    setImportError(null)
    setDone(null)
    setResolved(null)
    try {
      const result = parseFoodCsv(parseCsv(await file.text()), knownKeys)
      setFileName(file.name)
      setParsed(result)
      if (result.records.length > 0) void resolveAll(result.records)
    } catch (e) {
      setParsed(null)
      setImportError(errorMessage(e, 'Could not read the file.'))
    }
  }

  async function resolveAll(rows: ImportFoodRecord[]) {
    const out = new Array<ResolvedRow>(rows.length)
    let nextIdx = 0
    let completed = 0
    setProgress({ done: 0, total: rows.length })
    async function worker() {
      for (;;) {
        const i = nextIdx++
        if (i >= rows.length) return
        out[i] = await resolveRow(rows[i]!)
        completed += 1
        setProgress({ done: completed, total: rows.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(POOL, rows.length) }, worker))
    out.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    setProgress(null)
    setResolved(out)
  }

  function acceptManual(i: number) {
    // Import the CSV row as a custom food — drop any (wrong) USDA match so it isn't reused next time.
    const input = resolved?.[i]?.input
    if (input) removeCachedFoodMatch(input.name)
    setResolved(
      (prev) =>
        prev?.map((row, j) =>
          j === i ? { ...row, match: null, status: 'manual' } : row,
        ) ?? prev,
    )
  }

  async function applyFix(i: number, food: ExternalFood) {
    setFixIndex(null)
    setImportError(null)
    const input = resolved?.[i]?.input
    try {
      const detail = await getUsdaFood(food.externalId)
      if (input) setCachedFoodMatch(input.name, detail) // persist the correction across re-imports
      setResolved(
        (prev) =>
          prev?.map((row, j) =>
            j === i ? { ...row, match: detail, status: 'ok' } : row,
          ) ?? prev,
      )
    } catch (e) {
      setImportError(
        errorMessage(e, 'Could not load that food — please try Change again.'),
      )
    }
  }

  async function runImport() {
    if (!userId || !resolved || resolved.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const counts = await saveImportedFoods(
        userId,
        resolved.map((r) => ({ input: r.input, match: r.match })),
      )
      bumpDiary()
      setDone(counts)
    } catch (e) {
      setImportError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const skipped = parsed?.errors ?? []
  const rowCount = resolved?.length ?? 0
  const noMatch = resolved?.filter((r) => r.status === 'nomatch').length ?? 0
  const review = resolved?.filter((r) => r.status === 'review').length ?? 0

  return (
    <Sheet variant="full" label="Import foods">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">Import Foods</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {refLoading ? (
          <p className="text-body text-text-secondary">Loading…</p>
        ) : done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-text-primary">
              Imported {done.created + done.updated} food
              {done.created + done.updated === 1 ? '' : 's'} — {done.created} new,{' '}
              {done.updated} updated.
            </p>
            <p className="text-body text-text-secondary">
              They’re in your Favorites (and Custom, where USDA had no match).
            </p>
          </div>
        ) : (
          <>
            <p className="text-body text-text-secondary">
              Upload a CSV in the{' '}
              <code className="text-text-primary">wellness-foods-template.csv</code>{' '}
              format (see <code className="text-text-primary">templates/</code>). Each row
              is matched against USDA; rows USDA can’t find import as custom foods. All
              import as favorites.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = '' // allow re-picking the same file
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

            {skipped.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-medium text-danger">
                  {skipped.length} row{skipped.length === 1 ? '' : 's'} skipped:
                </p>
                <ul className="flex flex-col gap-1 text-caption text-danger">
                  {skipped.slice(0, MAX_MESSAGES).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {skipped.length > MAX_MESSAGES && (
                    <li>…and {skipped.length - MAX_MESSAGES} more.</li>
                  )}
                </ul>
              </div>
            )}

            {progress && (
              <p className="text-body text-text-secondary">
                Matching foods… {progress.done}/{progress.total}
              </p>
            )}

            {resolved && rowCount > 0 && (
              <>
                <div className="rounded-card border border-border bg-surface px-4 py-3 text-body text-text-primary">
                  Ready to import <strong>{rowCount}</strong> food
                  {rowCount === 1 ? '' : 's'}.
                  {(noMatch > 0 || review > 0) && (
                    <span className="text-text-secondary">
                      {' '}
                      {noMatch > 0 && `${noMatch} no-match`}
                      {noMatch > 0 && review > 0 && ', '}
                      {review > 0 && `${review} to review`} — tap <strong>Change</strong>{' '}
                      to fix, or <strong>Manual</strong> to keep as a custom food.
                    </span>
                  )}
                </div>

                <ImportPreviewList
                  items={resolved.map((r) => {
                    const { count, serving } = rowMeta(r)
                    return {
                      title: r.match?.name ?? r.input.name,
                      subtitle:
                        r.match && !sameName(r.match.name, r.input.name)
                          ? `from “${r.input.name}”`
                          : undefined,
                      meta: (
                        <>
                          {r.input.type === 'supplement' && (
                            <span className="rounded-pill bg-input px-1.5 py-0.5 text-text-tertiary">
                              Supplement
                            </span>
                          )}
                          <span>
                            {count} nutrient{count === 1 ? '' : 's'} · {serving}
                          </span>
                        </>
                      ),
                      status: r.status,
                      reviewLabel: r.input.name,
                    }
                  })}
                  onChange={(i) => setFixIndex(i)}
                  onManual={(i) => acceptManual(i)}
                />
              </>
            )}

            {parsed && parsed.warnings.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-medium text-text-secondary">Warnings:</p>
                <ul className="flex flex-col gap-1 text-caption text-text-secondary">
                  {parsed.warnings.slice(0, MAX_MESSAGES).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {parsed.warnings.length > MAX_MESSAGES && (
                    <li>…and {parsed.warnings.length - MAX_MESSAGES} more.</li>
                  )}
                </ul>
              </div>
            )}

            {importError && <p className="text-caption text-danger">{importError}</p>}
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
            disabled={importing || !resolved || rowCount === 0 || progress !== null}
            className="w-full"
          >
            {importing
              ? 'Importing…'
              : rowCount > 0
                ? `IMPORT ${rowCount} FOOD${rowCount === 1 ? '' : 'S'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>

      {fixIndex !== null && resolved && (
        <FoodSearchOverlay
          initialQuery={resolved[fixIndex]!.input.name}
          onSelect={(food) => void applyFix(fixIndex, food)}
          onClose={() => setFixIndex(null)}
        />
      )}
    </Sheet>
  )
}
