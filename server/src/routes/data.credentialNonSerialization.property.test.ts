import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import { setCache } from "../posts/cache.js";
import type { Tweet } from "../domain/types.js";

/**
 * Property 9: Credentials never appear in any serialized response.
 *
 * The external social-API credential is read by the Live_Posts_Provider from
 * `LIVE_POSTS_BEARER_TOKEN` and used to authenticate the outbound fetch. It
 * must never leak back to the client: not in the serialized response body, and
 * not in any response header, on EITHER a success (200) or an error (503)
 * response (Req 5.2, 5.3).
 *
 * To prove this across every orchestration state, a distinctive sentinel value
 * is placed in `LIVE_POSTS_BEARER_TOKEN` for each run. Because the sentinel is
 * distinctive, if it ever surfaced in the body or a header it would be found by
 * a substring scan.
 *
 * The three orchestration axes are driven directly (mirroring
 * data.tweetsSource.property.test.ts):
 *   - cache empty/fresh/stale: seed the module cache via `setCache(posts,
 *     fetchedAt)` with an explicit `fetchedAt` relative to now, with a fixed
 *     in-range lifetime of 300s.
 *   - live outcome success/rate-limited/failed: stub the global `fetch` the
 *     provider calls — a 200 JSON body is success, HTTP 429 is rate-limited,
 *     and a rejected promise is a network failure. This keeps the test off the
 *     real network while still exercising the credential-bearing fetch path.
 *
 * Live posting is always ENABLED here (the sentinel token is set), so the
 * credential-using code paths are actually taken. Both `GET /api/tweets`
 * (which can produce 200 or the sanctioned 503) and `GET /api/tweets/status`
 * are scanned.
 *
 * Environment and the module cache are saved and restored around every run so
 * runs do not leak state into each other.
 *
 * Validates: Requirements 5.2, 5.3
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";
const CACHE_TTL_ENV = "EASYELECT_POSTS_CACHE_TTL_SECONDS";

/** A distinctive sentinel so any leak is unambiguous in a substring scan. */
const SENTINEL = "SENTINEL_CREDENTIAL_zzz123";

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

type CacheState = "empty" | "fresh" | "stale";
type Outcome = "success" | "rateLimited" | "failed";

/**
 * Install a global `fetch` stub that produces the requested live outcome. The
 * returned restorer puts the original `fetch` back.
 */
function stubFetch(outcome: Outcome): () => void {
  const original = globalThis.fetch;

  if (outcome === "success") {
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
    setCache([], now);
  } else if (state === "fresh") {
    setCache([seedTweet], now);
  } else {
    setCache([seedTweet], now - 600_000);
  }
}

/** True if the sentinel appears anywhere in the serialized body or headers. */
function sentinelLeaks(res: request.Response): boolean {
  const bodyText = JSON.stringify(res.body ?? {});
  if (bodyText.includes(SENTINEL)) {
    return true;
  }
  // `res.text` catches any non-JSON serialized body too.
  if (typeof res.text === "string" && res.text.includes(SENTINEL)) {
    return true;
  }
  // Scan every header name and value.
  const headers = res.headers ?? {};
  for (const [name, value] of Object.entries(headers)) {
    if (name.includes(SENTINEL)) {
      return true;
    }
    const serialized = Array.isArray(value) ? value.join(",") : String(value);
    if (serialized.includes(SENTINEL)) {
      return true;
    }
  }
  return false;
}

describe("Property 9: credentials never appear in any serialized response", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];
  const originalTtl = process.env[CACHE_TTL_ENV];

  afterEach(() => {
    if (originalToken === undefined) delete process.env[BEARER_TOKEN_ENV];
    else process.env[BEARER_TOKEN_ENV] = originalToken;
    if (originalTtl === undefined) delete process.env[CACHE_TTL_ENV];
    else process.env[CACHE_TTL_ENV] = originalTtl;
    setCache([], Date.now());
  });

  it("never leaks the sentinel credential in body or headers, on 200 or 503", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<CacheState>("empty", "fresh", "stale"),
        fc.constantFrom<Outcome>("success", "rateLimited", "failed"),
        async (cacheState, outcome) => {
          // --- Arrange: live posting enabled with the sentinel credential ---
          process.env[BEARER_TOKEN_ENV] = SENTINEL;
          // A fixed, in-range lifetime so "fresh" vs "stale" is deterministic.
          process.env[CACHE_TTL_ENV] = "300";

          seedCache(cacheState);
          const restoreFetch = stubFetch(outcome);

          try {
            // --- Act: both tweets endpoints exercise the credential path ----
            const tweetsRes = await request(app).get("/api/tweets");
            const statusRes = await request(app).get("/api/tweets/status");

            // --- Assert -----------------------------------------------------
            // GET /api/tweets is either a 200 envelope or the sanctioned 503.
            expect([200, 503]).toContain(tweetsRes.status);
            // The sentinel must appear in NEITHER body nor any header.
            expect(sentinelLeaks(tweetsRes)).toBe(false);

            // GET /api/tweets/status reports only the boolean flag.
            expect(statusRes.status).toBe(200);
            expect(sentinelLeaks(statusRes)).toBe(false);
            // Sanity: the status body carries the flag and not the token.
            expect(statusRes.body).toEqual({ livePostsEnabled: true });
          } finally {
            restoreFetch();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
