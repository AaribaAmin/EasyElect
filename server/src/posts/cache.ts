/**
 * Post cache — a single-process, in-memory, time-stamped store.
 *
 * No external datastore (MVP-appropriate, matching the stateless AI provider).
 * The cache holds the most recently fetched live posts along with the UTC
 * timestamp at which they were retrieved, so the route orchestration can serve
 * fresh cache without an external call and fall back to a live fetch when stale.
 *
 * The optional `now?` parameter on time-sensitive functions keeps the freshness
 * logic deterministic and unit-testable without faking the global clock.
 */
import type { News_Item } from "../domain/types.js";

export interface CacheEntry {
  posts: News_Item[];
  /** UTC retrieval timestamp (epoch ms). */
  fetchedAt: number;
}

/** Default cache lifetime in seconds when unset/invalid. */
const DEFAULT_LIFETIME_SECONDS = 300;
/** Clamp bounds for the configured lifetime, inclusive. */
const MIN_LIFETIME_SECONDS = 1;
const MAX_LIFETIME_SECONDS = 86400;

/** The single in-memory cache slot. `null` until first populated. */
let entry: CacheEntry | null = null;

/** Replace cache contents and stamp the retrieval time (UTC). */
export function setCache(posts: News_Item[], now?: number): void {
  entry = {
    posts,
    fetchedAt: now ?? Date.now(),
  };
}

/** Current cache entry, or null if never populated. */
export function getCache(): CacheEntry | null {
  return entry;
}

/** True when the cache has one or more posts. */
export function isCacheNonEmpty(): boolean {
  return entry !== null && entry.posts.length > 0;
}

/** True when a non-empty cache's age (now - fetchedAt) <= lifetime seconds. */
export function isFresh(lifetimeSeconds: number, now?: number): boolean {
  if (!isCacheNonEmpty()) {
    return false;
  }
  const current = now ?? Date.now();
  const ageSeconds = (current - entry!.fetchedAt) / 1000;
  return ageSeconds <= lifetimeSeconds;
}

/** Configured lifetime in seconds, clamped to [1, 86400], default 300. */
export function cacheLifetimeSeconds(): number {
  const raw = process.env.EASYELECT_POSTS_CACHE_TTL_SECONDS;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_LIFETIME_SECONDS;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_LIFETIME_SECONDS;
  }
  if (parsed < MIN_LIFETIME_SECONDS || parsed > MAX_LIFETIME_SECONDS) {
    return DEFAULT_LIFETIME_SECONDS;
  }
  return parsed;
}
