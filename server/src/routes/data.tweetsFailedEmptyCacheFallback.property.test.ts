import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import { setCache } from "../posts/cache.js";
import { tweets } from "../domain/tweets.js";

/**
 * Property 14: A failed fetch with an empty cache serves the fallback dataset.
 *
 * For ANY failed live outcome — a 10s timeout, a network error, or any
 * non-success, non-rate-limit HTTP status — while live posting is ENABLED and
 * the cache is EMPTY, `GET /api/tweets` must degrade to the
 * Fallback_Posts_Dataset. The response is the success envelope (HTTP 200) with
 * `source: "fallback"` and `posts` equal to the fallback dataset (`tweets`
 * imported from domain/tweets.js). The genuine-only dataset is empty whenever
 * no verified x.com posts exist, so this asserts `posts` equals that dataset
 * exactly. A failed attempt never writes the cache, so no partial/live records
 * leak in.
 *
 * The axes exercised:
 *   - enabled: `LIVE_POSTS_BEARER_TOKEN` is set, so the route attempts a fetch.
 *   - empty cache: `setCache([])` makes `isCacheNonEmpty()` false, so there is
 *     nothing to serve from cache and the failed branch must fall back.
 *   - failed outcome (varied): the global `fetch` the provider calls is stubbed
 *     to produce either a rejected promise (network error), an abort-style
 *     hang resolved as rejection (timeout-equivalent), or a non-success HTTP
 *     status that is NOT 429 (so the provider classifies it as `failed`, not
 *     `rateLimited`).
 *
 * Environment and the module cache are saved/restored around every run so runs
 * do not leak state into each other.
 *
 * Validates: Requirements 7.2
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";
const CACHE_TTL_ENV = "EASYELECT_POSTS_CACHE_TTL_SECONDS";

const app = createApp();

/**
 * The varieties of a "failed" live outcome. Each must be classified by the
 * provider as `{ kind: "failed" }` (never `rateLimited`, never `ok`).
 */
type FailureKind =
  | { tag: "networkError" }
  | { tag: "abort" }
  | { tag: "status"; status: number };

/**
 * Install a global `fetch` stub that produces the requested failed outcome.
 * Returns a restorer that reinstates the original `fetch`.
 */
function stubFailedFetch(failure: FailureKind): () => void {
  const original = globalThis.fetch;

  if (failure.tag === "networkError") {
    // A rejected promise — the provider catches it and returns "failed".
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
  } else if (failure.tag === "abort") {
    // Simulate the request being aborted (as the 10s timeout would do): reject
    // with an AbortError. The provider's catch treats any rejection as failed.
    globalThis.fetch = (async () => {
      const err = new Error("The operation was aborted.");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;
  } else {
    // A non-success response whose status is NOT 429, so `!res.ok` sends the
    // provider down the "failed" branch rather than "rateLimited".
    globalThis.fetch = (async () =>
      new Response("error", {
        status: failure.status,
      })) as unknown as typeof fetch;
  }

  return () => {
    globalThis.fetch = original;
  };
}

describe("Property 14: failed fetch with empty cache serves the fallback dataset", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];
  const originalTtl = process.env[CACHE_TTL_ENV];

  afterEach(() => {
    if (originalToken === undefined) delete process.env[BEARER_TOKEN_ENV];
    else process.env[BEARER_TOKEN_ENV] = originalToken;
    if (originalTtl === undefined) delete process.env[CACHE_TTL_ENV];
    else process.env[CACHE_TTL_ENV] = originalTtl;
    // Reset the module cache to a known-empty slot between runs.
    setCache([], Date.now());
  });

  it("returns HTTP 200 with source 'fallback' and the fallback posts, for any failure", async () => {
    // A generator over the three failure varieties. Non-success statuses are
    // drawn from common non-429 codes (and deliberately include none == 429).
    const failureArb: fc.Arbitrary<FailureKind> = fc.oneof(
      fc.constant<FailureKind>({ tag: "networkError" }),
      fc.constant<FailureKind>({ tag: "abort" }),
      fc
        .constantFrom(400, 401, 403, 404, 500, 502, 503)
        .map<FailureKind>((status) => ({ tag: "status", status })),
    );

    await fc.assert(
      fc.asyncProperty(failureArb, async (failure) => {
        // --- Arrange -----------------------------------------------------
        // Enabled: credentials present so a live fetch is attempted.
        process.env[BEARER_TOKEN_ENV] = "sentinel-token";
        // Fixed, in-range lifetime (value is irrelevant for an empty cache).
        process.env[CACHE_TTL_ENV] = "300";
        // Empty cache: nothing to serve from cache ⇒ must fall back.
        setCache([], Date.now());

        const restoreFetch = stubFailedFetch(failure);

        try {
          // --- Act -------------------------------------------------------
          const res = await request(app).get("/api/tweets");

          // --- Assert ----------------------------------------------------
          // A failed outcome with an empty cache degrades to fallback (Req 7.2):
          // a 200 success envelope, source "fallback", posts === the dataset.
          expect(res.status).toBe(200);
          expect(res.body.source).toBe("fallback");
          expect(res.body.posts).toEqual(tweets);
        } finally {
          restoreFetch();
        }
      }),
      { numRuns: 100 },
    );
  });
});
