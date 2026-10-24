import { describe, it, expect, afterEach, vi } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import { setCache } from "../posts/cache.js";
import type { Tweet } from "../domain/types.js";

/**
 * Property 11: Stale cache triggers a fresh fetch.
 *
 * For any NON-EMPTY cache whose age (now - fetchedAt) EXCEEDS the configured
 * lifetime (`EASYELECT_POSTS_CACHE_TTL_SECONDS`), with live posting ENABLED,
 * a `GET /api/tweets` request must attempt a fresh external fetch before
 * responding — the stale cache alone is never good enough to short-circuit the
 * network (Req 6.3, 10.2).
 *
 * The property drives the staleness margin and the lifetime directly:
 *   - A non-empty cache is seeded via `setCache(posts, fetchedAt)` with an OLD
 *     `fetchedAt` so that `now - fetchedAt` is strictly greater than the
 *     configured lifetime in seconds.
 *   - The lifetime is set via `EASYELECT_POSTS_CACHE_TTL_SECONDS` (an in-range
 *     integer so freshness is deterministic).
 *   - Live posting is enabled by setting `LIVE_POSTS_BEARER_TOKEN`.
 *   - A `fetch` spy is installed via `vi.spyOn(globalThis, "fetch")`. The
 *     outcome of the stub (a valid 200 response OR a failure) is irrelevant to
 *     this property: either way, the external fetch MUST have been attempted.
 *     The assertion is simply that the spy was called at least once.
 *
 * Environment and the module cache are saved/restored around every run so runs
 * do not leak state into each other.
 *
 * Validates: Requirements 6.3, 10.2
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";
const CACHE_TTL_ENV = "EASYELECT_POSTS_CACHE_TTL_SECONDS";

const app = createApp();

/** A minimal, structurally valid Tweet for seeding a non-empty cache. */
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

/** A valid 200 response whose adapted body yields one handle-matched post. */
function okResponse(): Response {
  return new Response(
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
  );
}

describe("Property 11: a stale non-empty cache triggers a fresh external fetch", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];
  const originalTtl = process.env[CACHE_TTL_ENV];

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) delete process.env[BEARER_TOKEN_ENV];
    else process.env[BEARER_TOKEN_ENV] = originalToken;
    if (originalTtl === undefined) delete process.env[CACHE_TTL_ENV];
    else process.env[CACHE_TTL_ENV] = originalTtl;
    // Reset the shared cache so no run leaks state into the next.
    setCache([]);
  });

  it("attempts the external fetch whenever the cache is non-empty but stale", async () => {
    await fc.assert(
      fc.asyncProperty(
        // An in-range integer lifetime so freshness is deterministic.
        fc.integer({ min: 1, max: 86400 }),
        // How many seconds PAST the lifetime the cache was fetched (strictly
        // positive ⇒ guaranteed stale).
        fc.integer({ min: 1, max: 86400 }),
        // The fetch outcome is irrelevant: either a 200 or a thrown failure —
        // the property only asserts the attempt happened.
        fc.boolean(),
        async (lifetimeSeconds, overshootSeconds, succeed) => {
          // --- Arrange -------------------------------------------------------
          // Live posting enabled.
          process.env[BEARER_TOKEN_ENV] = "sentinel-token";
          process.env[CACHE_TTL_ENV] = String(lifetimeSeconds);

          // Seed a NON-EMPTY cache with an OLD fetchedAt so that
          // (now - fetchedAt) in seconds strictly exceeds the lifetime.
          const now = Date.now();
          const ageSeconds = lifetimeSeconds + overshootSeconds;
          const fetchedAt = now - ageSeconds * 1000;
          setCache([seedTweet], fetchedAt);

          // Install a fetch spy. The stub either succeeds (200) or fails
          // (rejected promise); both are valid for this property.
          const fetchSpy = vi.spyOn(globalThis, "fetch");
          if (succeed) {
            fetchSpy.mockResolvedValue(okResponse());
          } else {
            fetchSpy.mockRejectedValue(new Error("network down"));
          }

          try {
            // --- Act ---------------------------------------------------------
            const res = await request(app).get("/api/tweets");

            // --- Assert ------------------------------------------------------
            // The external fetch WAS attempted because the cache was stale.
            expect(fetchSpy).toHaveBeenCalled();
            // The endpoint always responds (200 envelope here: a failed fetch
            // with a non-empty cache falls back to serving the stale cache).
            expect([200, 503]).toContain(res.status);
          } finally {
            fetchSpy.mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
