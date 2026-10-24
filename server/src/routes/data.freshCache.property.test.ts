import { describe, it, expect, afterEach, vi } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import { setCache } from "../posts/cache.js";
import type { Tweet } from "../domain/types.js";

/**
 * Property 10: Fresh cache is served without an external call (endpoint-level).
 *
 * For ANY non-empty cache and ANY current time whose offset from the retrieval
 * timestamp (`fetchedAt`) is within the configured lifetime, `GET /api/tweets`
 * responds with `source: "cache"` while making ZERO external fetch calls.
 *
 * The orchestration state is driven directly:
 *   - enabled: `LIVE_POSTS_BEARER_TOKEN` is set to a sentinel so live posting
 *     is enabled and the freshness gate is actually reached (the disabled
 *     branch would short-circuit to fallback before consulting the cache).
 *   - non-empty cache: seed the module cache via `setCache(posts, fetchedAt)`
 *     with one or more structurally valid Tweets and a `fetchedAt` set to
 *     `now - offsetMs` so the cache age is exactly `offsetMs`.
 *   - freshness: choose the lifetime via `EASYELECT_POSTS_CACHE_TTL_SECONDS`
 *     and generate `offsetMs` strictly within `lifetime` seconds, so
 *     `now - fetchedAt <= lifetime` holds and the cache is fresh.
 *
 * A `fetch` spy is installed on `globalThis` and asserted to be never called,
 * which proves the fresh-cache branch short-circuits before any network access.
 *
 * Environment and the module cache are saved and restored around every run so
 * runs do not leak state into each other.
 *
 * Validates: Requirements 6.2, 10.3
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";
const CACHE_TTL_ENV = "EASYELECT_POSTS_CACHE_TTL_SECONDS";

const app = createApp();

/**
 * Generator for a non-empty list of structurally valid Tweets to seed the
 * cache. The content is arbitrary; the property only requires the cache be
 * non-empty.
 */
const nonEmptyPostsArb: fc.Arbitrary<Tweet[]> = fc
  .array(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 12 }),
      candidateId: fc.constant("maura-healey"),
      authorName: fc.constant("Maura Healey"),
      authorHandle: fc.constant("@maura_healey"),
      text: fc.string({ minLength: 1, maxLength: 40 }),
      date: fc.constant("2026-01-01"),
      likes: fc.nat({ max: 1000 }),
      reposts: fc.nat({ max: 1000 }),
      tabs: fc.constant<Tweet["tabs"]>(["recent"]),
      sourceUrl: fc.constant("https://example.com/seed"),
    }),
    { minLength: 1, maxLength: 5 },
  )
  // Give each post a unique id so the seeded cache is well-formed.
  .map((posts) =>
    posts.map((p, i) => ({ ...p, id: `${p.id}-${i}` }) as Tweet),
  );

describe("Property 10: fresh cache is served without an external call", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];
  const originalTtl = process.env[CACHE_TTL_ENV];

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) delete process.env[BEARER_TOKEN_ENV];
    else process.env[BEARER_TOKEN_ENV] = originalToken;
    if (originalTtl === undefined) delete process.env[CACHE_TTL_ENV];
    else process.env[CACHE_TTL_ENV] = originalTtl;
    // Reset the shared cache so no run leaks state into the next.
    setCache([], Date.now());
  });

  it("serves source: cache and never calls fetch for any within-lifetime cache", async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyPostsArb,
        // Lifetime in seconds, in the module's valid clamped range [1, 86400].
        fc.integer({ min: 1, max: 86400 }),
        // A fractional position in [0, 1] used to place the age within the
        // lifetime window (<= lifetime), so the cache is always fresh.
        fc.double({ min: 0, max: 1, noNaN: true }),
        async (posts, lifetimeSeconds, agePosition) => {
          // Enabled so the freshness gate is reached (disabled would fall back).
          process.env[BEARER_TOKEN_ENV] = "sentinel-token";
          process.env[CACHE_TTL_ENV] = String(lifetimeSeconds);

          // Age the cache by an offset strictly within the lifetime window.
          // The freshness check inside the route uses its own `Date.now()`,
          // which is a few ms later than the `now` captured here; reserving a
          // small headroom (a second, capped at a fraction of the lifetime)
          // keeps the boundary case `now - fetchedAt <= lifetime` honest and
          // non-flaky while still exercising ages right up to the lifetime.
          const now = Date.now();
          const headroomMs = Math.min(1000, lifetimeSeconds * 1000 * 0.1);
          const maxOffsetMs = lifetimeSeconds * 1000 - headroomMs;
          const offsetMs = Math.floor(maxOffsetMs * agePosition);
          setCache(posts, now - offsetMs);

          // Spy on the global fetch for this run; it must never be invoked on
          // the fresh-cache path.
          const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockRejectedValue(
              new Error("fetch must not be called when cache is fresh"),
            );

          try {
            const res = await request(app).get("/api/tweets");

            expect(res.status).toBe(200);
            expect(res.body.source).toBe("cache");
            expect(Array.isArray(res.body.posts)).toBe(true);
            expect(res.body.posts).toHaveLength(posts.length);

            // Zero external calls were made on the fresh-cache path.
            expect(fetchSpy).not.toHaveBeenCalled();
          } finally {
            fetchSpy.mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
