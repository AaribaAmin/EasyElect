import { describe, it, expect, afterEach, vi } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import { isLivePostsEnabled } from "../posts/provider.js";
import { setCache } from "../posts/cache.js";
import { tweets } from "../domain/tweets.js";

/**
 * Property 8: Disabled live posting serves fallback and makes no network call.
 *
 * For any server environment in which the Live_Credentials are absent or empty
 * (the bearer token is unset or whitespace-only), the disabled path must hold:
 *   - `isLivePostsEnabled()` is false,
 *   - `GET /api/tweets/status` reports `{ livePostsEnabled: false }`, and
 *   - `GET /api/tweets` returns `source: "fallback"` WITHOUT invoking the
 *     external fetch.
 *
 * A `fetch` spy is installed on `globalThis` and asserted to be never called,
 * which proves the disabled branch short-circuits before any network access.
 *
 * Validates: Requirements 5.4, 7.1
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";

const app = createApp();

/**
 * Generator for "absent or empty" credential states:
 *   - `undefined` models an unset environment variable, and
 *   - any whitespace-only string (including the empty string) models a present
 *     but effectively-empty token.
 */
const absentOrEmptyTokenArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(""),
  // Whitespace-only strings: spaces, tabs, newlines, carriage returns.
  fc
    .array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 8 })
    .map((chars) => chars.join("")),
);

describe("Property 8: disabled live posting serves fallback with no network call", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) {
      delete process.env[BEARER_TOKEN_ENV];
    } else {
      process.env[BEARER_TOKEN_ENV] = originalToken;
    }
    // Reset the shared cache so no run leaks state into the next.
    setCache([]);
  });

  it("reports disabled, serves fallback, and never calls fetch", async () => {
    await fc.assert(
      fc.asyncProperty(absentOrEmptyTokenArb, async (token) => {
        // Reset the cache between runs; the disabled branch must not read it,
        // but a clean slate keeps the property about the disabled path alone.
        setCache([]);

        // Apply the absent/empty credential state for this run.
        if (token === undefined) {
          delete process.env[BEARER_TOKEN_ENV];
        } else {
          process.env[BEARER_TOKEN_ENV] = token;
        }

        // Spy on the global fetch for this run; it must never be invoked.
        const fetchSpy = vi
          .spyOn(globalThis, "fetch")
          .mockRejectedValue(new Error("fetch must not be called in disabled mode"));

        try {
          // Credentials are absent/empty ⇒ live posting is disabled.
          expect(isLivePostsEnabled()).toBe(false);

          // The status endpoint reports live posting disabled (never the token).
          const status = await request(app).get("/api/tweets/status");
          expect(status.status).toBe(200);
          expect(status.body).toEqual({ livePostsEnabled: false });

          // The tweets endpoint serves the fallback dataset envelope. The
          // genuine-only dataset is empty when no verified x.com posts exist,
          // so `posts` equals the fallback dataset (`tweets`) exactly.
          const res = await request(app).get("/api/tweets");
          expect(res.status).toBe(200);
          expect(res.body.source).toBe("fallback");
          expect(res.body.posts).toEqual(tweets);

          // No external network call was made on the disabled path.
          expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
          fetchSpy.mockRestore();
        }
      }),
      { numRuns: 100 },
    );
  });
});
