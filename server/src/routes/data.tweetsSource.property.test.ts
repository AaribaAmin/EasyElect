import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import { setCache } from "../posts/cache.js";
import type { Tweet } from "../domain/types.js";

/**
 * Property 7: The source indicator is always exactly one of live, cache, or
 * fallback.
 *
 * For any orchestration state of `GET /api/tweets` — live posting enabled or
 * disabled; the cache empty, fresh, or stale; and the live outcome success,
 * rate-limited, or failed — the response either:
 *   (a) is a 200 envelope `{ posts, source }` whose `posts` is an array and
 *       whose `source` is EXACTLY one of "live" | "cache" | "fallback" (never
 *       missing, never two values); or
 *   (b) is the single sanctioned non-envelope outcome: the
 *       rate-limited-with-empty-cache branch, which returns HTTP 503 with an
 *       `{ error }` body and no `source`/`posts` (Req 6.5).
 *
 * The three orchestration axes are driven directly:
 *   - enabled/disabled: toggle `LIVE_POSTS_BEARER_TOKEN` in the environment
 *     (the provider reads `isLivePostsEnabled()` from it).
 *   - cache empty/fresh/stale: seed the module cache via `setCache(posts,
 *     fetchedAt)` with an explicit `fetchedAt` relative to now, and set the
 *     lifetime via `EASYELECT_POSTS_CACHE_TTL_SECONDS`. An empty posts array
 *     models an empty cache (`isCacheNonEmpty()` is false); a recent timestamp
 *     with a long lifetime models fresh; an old timestamp (or short lifetime)
 *     models stale.
 *   - live outcome success/rate-limited/failed: stub the global `fetch` the
 *     provider calls — a 200 JSON body is success, HTTP 429 is rate-limited,
 *     and a rejected promise is a network failure.
 *
 * Environment and the module cache are saved and restored around every run so
 * runs do not leak state into each other.
 *
 * Validates: Requirements 4.7, 7.4
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";
const CACHE_TTL_ENV = "EASYELECT_POSTS_CACHE_TTL_SECONDS";

const app = createApp();

/** A minimal, structurally valid Tweet for seeding the cache. */
const seedTweet: Tweet = {
  id: "seed-1",
  candidateId: "maura-healey",
  authorName: "Maura Healey",
  authorHandle: "@maura_healey",
  text: "Seeded cache post.",
  date: "2026-01-01",
  likes: 1,
  reposts: 0,
  tabs: ["recent"],
  sourceUrl: "https://example.com/seed-1",
};

/** The three orchestration axes, each as a small labelled set of choices. */
type CacheState = "empty" | "fresh" | "stale";
type Outcome = "success" | "rateLimited" | "failed";

/**
 * Install a global `fetch` stub that produces the requested live outcome. The
 * returned restorer puts the original `fetch` back.
 */
function stubFetch(outcome: Outcome): () => void {
  const original = globalThis.fetch;

  if (outcome === "success") {
    // A 200 response whose adapted body yields one public, handle-matched post
    // for maura-healey, so the mapper keeps at least one Tweet.
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "live-1",
              text: "A live post.",
              created_at: "2026-02-01T00:00:00.000Z",
              author_id: "u1",
              possibly_sensitive: false,
              public_metrics: { like_count: 5, retweet_count: 1 },
            },
          ],
          includes: {
            users: [
              {
                id: "u1",
                name: "Maura Healey",
                username: "maura_healey",
                protected: false,
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;
  } else if (outcome === "rateLimited") {
    globalThis.fetch = (async () =>
      new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
  } else {
    // Network error: the provider catches the rejection and returns "failed".
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
  }

  return () => {
    globalThis.fetch = original;
  };
}

/** Seed the module cache to model empty / fresh / stale for a 300s lifetime. */
function seedCache(state: CacheState): void {
  const now = Date.now();
  if (state === "empty") {
    // An empty posts array makes isCacheNonEmpty() false — i.e. "no cache".
    setCache([], now);
  } else if (state === "fresh") {
    // Non-empty and retrieved just now, well within the 300s lifetime.
    setCache([seedTweet], now);
  } else {
    // Non-empty but retrieved long ago (10 minutes) — past the 300s lifetime.
    setCache([seedTweet], now - 600_000);
  }
}

describe("Property 7: GET /api/tweets source discriminator is always exactly one value", () => {
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

  it("returns a single valid source or the sanctioned 503, across every state", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // live enabled?
        fc.constantFrom<CacheState>("empty", "fresh", "stale"),
        fc.constantFrom<Outcome>("success", "rateLimited", "failed"),
        async (enabled, cacheState, outcome) => {
          // --- Arrange the orchestration state -----------------------------
          if (enabled) process.env[BEARER_TOKEN_ENV] = "sentinel-token";
          else delete process.env[BEARER_TOKEN_ENV];
          // A fixed, in-range lifetime so "fresh" vs "stale" is deterministic.
          process.env[CACHE_TTL_ENV] = "300";

          seedCache(cacheState);
          const restoreFetch = stubFetch(outcome);

          try {
            // --- Act -------------------------------------------------------
            const res = await request(app).get("/api/tweets");

            // --- Assert ----------------------------------------------------
            // The one sanctioned non-envelope outcome: live enabled, a stale or
            // empty cache (so a live fetch is attempted), the fetch is
            // rate-limited, and the cache is empty ⇒ HTTP 503 error, no
            // envelope (Req 6.5).
            if (res.status === 503) {
              expect(res.body).toHaveProperty("error");
              expect(res.body).not.toHaveProperty("source");
              expect(res.body).not.toHaveProperty("posts");
              return;
            }

            // Every other outcome is a 200 envelope.
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.posts)).toBe(true);

            // `source` is present and is EXACTLY one of the three values —
            // never missing, never two.
            const validSources = ["live", "cache", "fallback"];
            expect(validSources).toContain(res.body.source);
            // Exactly one: it matches a single member of the set.
            const matches = validSources.filter((s) => s === res.body.source);
            expect(matches).toHaveLength(1);
          } finally {
            restoreFetch();
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
