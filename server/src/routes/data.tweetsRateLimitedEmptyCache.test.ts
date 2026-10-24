import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { setCache, getCache } from "../posts/cache.js";

/**
 * Unit test for the rate-limit-with-empty-cache error branch of
 * `GET /api/tweets` (Task 8.10, Req 6.5).
 *
 * When live posting is ENABLED and the Post_Cache is EMPTY, a rate-limit
 * response (HTTP 429) from the external social API must drive the endpoint down
 * the error branch: respond HTTP 503 with a body whose message indicates that
 * live posts are "temporarily unavailable", and retain NO partial Post_Records
 * (the cache is left untouched / still empty — a rate-limited attempt never
 * calls setCache).
 *
 * Arrange axes, driven directly:
 *   - enabled: set `LIVE_POSTS_BEARER_TOKEN` so `isLivePostsEnabled()` is true.
 *   - empty cache: `setCache([])` so `isCacheNonEmpty()` is false and there is
 *     nothing to serve from cache, forcing the empty-cache error branch.
 *   - rate-limited outcome: stub the global `fetch` the provider calls to
 *     return HTTP 429, which the provider classifies as `{ kind: "rateLimited" }`.
 *
 * Environment and the module cache are saved/restored around the test so it
 * does not leak state into other tests.
 *
 * _Requirements: 6.5_
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";
const CACHE_TTL_ENV = "EASYELECT_POSTS_CACHE_TTL_SECONDS";

const app = createApp();

/**
 * Install a global `fetch` stub that returns HTTP 429 (rate-limited). Returns a
 * restorer that reinstates the original `fetch`.
 */
function stubRateLimitedFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe("GET /api/tweets rate-limited with an empty cache", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];
  const originalTtl = process.env[CACHE_TTL_ENV];

  afterEach(() => {
    if (originalToken === undefined) delete process.env[BEARER_TOKEN_ENV];
    else process.env[BEARER_TOKEN_ENV] = originalToken;
    if (originalTtl === undefined) delete process.env[CACHE_TTL_ENV];
    else process.env[CACHE_TTL_ENV] = originalTtl;
    // Reset the module cache to a known-empty slot after the test.
    setCache([], Date.now());
  });

  it("responds 503 'temporarily unavailable' and retains no partial records", async () => {
    // --- Arrange -------------------------------------------------------
    // Enabled: credentials present so a live fetch is attempted.
    process.env[BEARER_TOKEN_ENV] = "sentinel-token";
    // In-range lifetime (value is irrelevant for an empty cache).
    process.env[CACHE_TTL_ENV] = "300";
    // Empty cache: nothing to serve ⇒ the rate-limit error branch must fire.
    setCache([], Date.now());

    const restoreFetch = stubRateLimitedFetch();

    try {
      // --- Act ---------------------------------------------------------
      const res = await request(app).get("/api/tweets");

      // --- Assert: error envelope --------------------------------------
      // Rate-limited with an empty cache ⇒ HTTP 503 (Req 6.5).
      expect(res.status).toBe(503);
      // The error message indicates live posts are temporarily unavailable.
      expect(res.body.error).toBeTypeOf("string");
      expect(res.body.error.toLowerCase()).toContain("temporarily unavailable");
      // No success envelope leaks through.
      expect(res.body.posts).toBeUndefined();
      expect(res.body.source).toBeUndefined();

      // --- Assert: no partial records retained -------------------------
      // The cache must be left untouched / still empty — a rate-limited
      // attempt never calls setCache, so no partial/live records leak in.
      const stored = getCache();
      // Still the empty slot seeded in Arrange (posts remain empty).
      expect(stored).not.toBeNull();
      expect(stored!.posts).toEqual([]);
    } finally {
      restoreFetch();
    }
  });
});
