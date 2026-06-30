import { supabase } from '../lib/supabase'
import type {
  LiteratureMeta,
  PoemDetail,
  PoemIndexEntry,
  WriterDetail,
} from '../lib/literature'

/**
 * Typed data-access for the Literature module — the single access point (components never fetch).
 * Two sources:
 *   * the immutable corpus is a STATIC ASSET under /literature/** (precached index + meta;
 *     runtime-cached poem/<id> + writer/<id> bodies). See scripts/build-literature-data.mjs.
 *   * per-user favourites live in Supabase (`poem_favorite`), RLS-isolated by user_id.
 */

/** Runtime cache for poem/writer bodies — MUST match the cacheName in vite.config.ts runtimeCaching. */
const BODY_CACHE = 'literature-bodies-v1'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`)
  return (await res.json()) as T
}

// The corpus is immutable for the session, so memoize meta + index (clear on failure to allow retry).
let metaPromise: Promise<LiteratureMeta> | null = null
let indexPromise: Promise<PoemIndexEntry[]> | null = null

export function loadMeta(): Promise<LiteratureMeta> {
  if (!metaPromise) {
    metaPromise = fetchJson<LiteratureMeta>('/literature/meta.json').catch(
      (e: unknown) => {
        metaPromise = null
        throw e
      },
    )
  }
  return metaPromise
}

export function loadIndex(): Promise<PoemIndexEntry[]> {
  if (!indexPromise) {
    indexPromise = fetchJson<PoemIndexEntry[]>('/literature/index.json').catch(
      (e: unknown) => {
        indexPromise = null
        throw e
      },
    )
  }
  return indexPromise
}

export function getPoem(id: number): Promise<PoemDetail> {
  return fetchJson<PoemDetail>(`/literature/poem/${id}.json`)
}

export function getWriter(id: number): Promise<WriterDetail> {
  return fetchJson<WriterDetail>(`/literature/writer/${id}.json`)
}

/**
 * Ensure a poem body is in the runtime cache so it reads offline even if never opened — called when a
 * poem is favourited (the lazy default otherwise caches only what's been opened). Non-fatal: a failure
 * (storage disabled, offline at favourite time) just means it isn't pre-cached.
 */
async function cachePoemOffline(id: number): Promise<void> {
  try {
    if (typeof caches === 'undefined') return
    const cache = await caches.open(BODY_CACHE)
    await cache.add(`/literature/poem/${id}.json`)
  } catch {
    // best-effort offline pre-cache
  }
}

// --- favourites (Supabase) ---------------------------------------------------------------------

/** The poem ids this user has favourited (drives heart fill across cards + the Favorites screen). */
export async function listFavoriteIds(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('poem_favorite')
    .select('poem_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((r) => r.poem_id)
}

/** Idempotent (composite PK + ignoreDuplicates) — also pre-caches the body for offline reading. */
export async function addFavorite(userId: string, poemId: number): Promise<void> {
  const { error } = await supabase
    .from('poem_favorite')
    .upsert(
      { user_id: userId, poem_id: poemId },
      { onConflict: 'user_id,poem_id', ignoreDuplicates: true },
    )
  if (error) throw error
  await cachePoemOffline(poemId)
}

export async function removeFavorite(userId: string, poemId: number): Promise<void> {
  const { error } = await supabase
    .from('poem_favorite')
    .delete()
    .match({ user_id: userId, poem_id: poemId })
  if (error) throw error
}
