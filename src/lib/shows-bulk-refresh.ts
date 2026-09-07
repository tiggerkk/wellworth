import {
  buildRefreshPatch,
  totalWatchedEpisodes,
  usesEpisodes,
  type ShowRow,
  type ShowUpdate,
} from './shows'
import { refreshFromTmdb } from './shows-tmdb-api'

/**
 * "New content" detection for the bulk TMDB refresh result list: true when the refreshed metadata
 * shows more episodes are now available than the owner has watched, for a title that had already
 * caught up to (or exceeded) its previous known total. Used only to flag rows in the Settings
 * result list — the dashboard's "Caught Up" chip itself is derived live from the saved row via
 * `isCaughtUp`, not from this flag.
 */
export function hasNewEpisodesAvailable(
  before: Pick<
    ShowRow,
    'watched_seasons' | 'watched_episodes' | 'total_episodes' | 'season_episode_counts'
  >,
  afterTotalEpisodes: number | null,
): boolean {
  const prevTotal = before.total_episodes ?? 0
  const nextTotal = afterTotalEpisodes ?? 0
  if (nextTotal <= prevTotal) return false
  return totalWatchedEpisodes(before) >= prevTotal
}

export interface BulkRefreshOutcome {
  show: Pick<ShowRow, 'id' | 'title'>
  changed: boolean
  newEpisodesAvailable: boolean
  error?: string
}

type RefreshableShow = Pick<
  ShowRow,
  'id' | 'status' | 'watched_seasons' | 'watched_episodes'
> &
  Parameters<typeof refreshFromTmdb>[0] &
  Parameters<typeof buildRefreshPatch>[0]

/** The Want/Watching, episodic, TMDB-linked shows the bulk refresh acts on. Movies are excluded —
 * they have no seasons/episodes to check for; "want" is included since an announced-but-unwatched
 * show can still gain a newly-released season. Exported so the Settings screen can show a count
 * before running. */
export function bulkRefreshCandidates<T extends RefreshableShow>(shows: T[]): T[] {
  return shows.filter(
    (s) =>
      (s.status === 'want' || s.status === 'watching') &&
      usesEpisodes(s.type) &&
      s.tmdb_id != null,
  )
}

/**
 * Bulk "Refresh all from TMDB": re-pulls each candidate sequentially (polite to the TMDB API) via
 * the same `buildRefreshPatch` the per-show Refresh button uses, so the two never drift. A show
 * that errors is reported with `error` set and does not stop the batch. `onProgress` reports
 * 1-based (`done`, `total`) so the caller can show a live counter.
 */
export async function refreshAllFromTmdb(
  candidates: RefreshableShow[],
  updateShow: (id: string, patch: ShowUpdate) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkRefreshOutcome[]> {
  const results: BulkRefreshOutcome[] = []
  for (let i = 0; i < candidates.length; i++) {
    const show = candidates[i]!
    try {
      const meta = await refreshFromTmdb(show)
      const { patch, changed } = buildRefreshPatch(show, meta)
      const newEpisodesAvailable = hasNewEpisodesAvailable(show, meta.total_episodes)
      if (changed) await updateShow(show.id, patch)
      results.push({ show, changed, newEpisodesAvailable })
    } catch (e) {
      results.push({
        show,
        changed: false,
        newEpisodesAvailable: false,
        error: e instanceof Error ? e.message : 'Refresh failed.',
      })
    }
    onProgress?.(i + 1, candidates.length)
  }
  return results
}
