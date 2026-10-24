import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import { setCache, getCache } from "../posts/cache.js";
import type { Tweet } from "../domain/types.js";

/**
 * Property 13: A failed or rate-limited fetch serves cache when present and
 * never loses or corrupts cache.
 *
 * For any non-empty cache, when live posting is enabled and a live fetch is
 * attempted (because the cache is stale), a fetch that is either rate-limited
 * (HTTP 429) or failed (network rejection / non-success) must:
 *   - serve a success envelope (HTTP 200) with `source: "cache"` whose `posts`
 *     equal the cached posts (Req 6.4, 7.3), and
 *   - leave the stored cache completely unchanged — the same posts AND the same
 *     `fetchedAt` timestamp, i.e. the last-successful-fetch timestamp is left
 *     unchanged because a failed/rate-limited attempt never re-stamps the cache
 *     (Req 10.4).
 *
 * To force a fetch attempt (rather than serving a fresh cache directly), every
 * run seeds a STALE cache: a non-empty set of posts stamped with a `fetchedAt`
 * well beyond the configured lifetime. The stale gate then drives the
 * orchestration into the live-fetch branch, where the stubbed `fetch` produces
 * the rate-limited or failed outcome under test.
 *
 * The orchestration axes are driven directly:
 *   - enabled: set `LIVE_POSTS_BEARER_TOKEN` so `isLivePostsEnabled()` is true.
 *   - stale non-empty cache: seed via `setCache(posts, fetchedAt)` with an old
 *     `fetchedAt`, and a fixed in-range lifetime via
 *     `EASYELECT_POSTS_CACHE_TTL_SECONDS`.
 *   - outcome rate-limited/failed: stub the global `fetch` the provider calls —
 *     HTTP 429 is rate-limited; a rejected promise is a network failure.
 *
 * Environment and the module cache are saved and restored around every run so
 * runs do not leak state into each other.
 *
 * Validates: Requirements 6.4, 7.3, 10.4
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";
const CACHE_TTL_ENV = "EASYELECT_POSTS_CACHE_TTL_SECONDS";

const app = createApp();

/** A failed fetch is either a rate-limit (429) or an outright failure. */
type FailureOutcome = "rateLimited" | "failed";

/**
 * Install a global `fetch` stub that produces the requested failure outcome.
 * The returned restorer puts the original `fetch` back.
 */
function stubFailingFetch(outcome: FailureOutcome): () => void {
  const original = globalThis.fetch;

  if (outcome === "rateLimited") {
    // HTTP 429 ⇒ the provider returns { kind: "rateLimited" }.
    globalThis.fetch = (async () =>
      new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
  } else {
    // Network rejection ⇒ the provider catches it and returns { kind: "failed" }.
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
  }

  return () => {
    globalThis.fetch = original;
  };
}

/**
 * A generator for a non-empty batch of structurally valid, cache-ready posts.
 * The posts never need to be handle-matched to a candidate because the cache is
 * seeded directly (bypassing the provider's mapping) — they only have to be a
 * faithful, non-empty `Tweet[]` so the orchestration treats the cache as
 * non-empty and round-trips them back out.
 */
const cachedPostsArb: fc.Arbitrary<Tweet[]> = fc
  .array(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 12 }),
      text: fc.string({ minLength: 1, maxLength: 60 }),
      likes: fc.nat({ max: 10_000 }),
      reposts: fc.nat({ max: 10_000 }),
    }),
    { minLength: 1, maxLength: 6 },
  )
  .map((rows) =>
    rows.map(
      (row, i): Tweet => ({
        id: `cached-${i}-${row.id}`,
        candidateId: "maura-healey",
        authorName: "Maura Healey",
        authorHandle: "@maura_healey",
        text: row.text,
        date: "2026-01-01",
        likes: row.likes,
        reposts: row.reposts,
        tabs: ["recent"],
        sourceUrl: `https://example.com/cached-${i}`,
      }),
    ),
  );

describe("Property 13: a failed/rate-limited fetch serves cache and leaves it intact", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];
  const originalTtl = process.env[CACHE_TTL_ENV];

  afterEach(() => {
    // Restore the environment after every run so axes do not leak.
    if (originalToken === undefined) delete process.env[BEARER_TOKEN_ENV];
    else process.env[BEARER_TOKEN_ENV] = originalToken;
    if (originalTtl === undefined) delete process.env[CACHE_TTL_ENV];
    else process.env[CACHE_TTL_ENV] = originalTtl;
    // Reset the module cache to a known-empty slot.
    setCache([], Date.now());
  });

  it("returns source=cache with the cached posts and never mutates the stored cache", async () => {
    await fc.assert(
      fc.asyncProperty(
        cachedPostsArb,
        fc.constantFrom<FailureOutcome>("rateLimited", "failed"),
        // Extra staleness beyond the lifetime, in seconds, so the cache is
        // always well past its freshness window (forcing a live fetch).
        fc.integer({ min: 1, max: 100_000 }),
        async (cachedPosts, outcome, extraStaleSeconds) => {
          // --- Arrange the orchestration state -----------------------------
          // Live posting enabled.
          process.env[BEARER_TOKEN_ENV] = "sentinel-token";
          // A fixed, in-range lifetime so staleness is deterministic.
          const lifetimeSeconds = 300;
          process.env[CACHE_TTL_ENV] = String(lifetimeSeconds);

          // Seed a STALE, non-empty cache: stamped far enough in the past that
          // (now - fetchedAt) exceeds the lifetime, so the endpoint attempts a
          // live fetch instead of serving the cache as fresh.
          const now = Date.now();
          const fetchedAt = now - (lifetimeSeconds + extraStaleSeconds) * 1000;
          setCache(cachedPosts, fetchedAt);

          const restoreFetch = stubFailingFetch(outcome);

          try {
            // --- Act -------------------------------------------------------
            const res = await request(app).get("/api/tweets");

            // --- Assert: success envelope served from cache ----------------
            expect(res.status).toBe(200);
            expect(res.body.source).toBe("cache");
            // The served posts equal the cached posts (round-trip, no loss).
            expect(res.body.posts).toEqual(cachedPosts);

            // --- Assert: the stored cache is unchanged ---------------------
            const stored = getCache();
            expect(stored).not.toBeNull();
            // Same posts (not lost, not corrupted).
            expect(stored!.posts).toEqual(cachedPosts);
            // Same last-successful timestamp (left unchanged by the failed
            // attempt — the provider never re-stamps on failure/rate-limit).
            expect(stored!.fetchedAt).toBe(fetchedAt);
          } finally {
            restoreFetch();
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
