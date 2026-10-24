import { describe, it, expect, afterEach, vi } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import { isLivePostsEnabled } from "../posts/provider.js";
import { setCache } from "../posts/cache.js";
import { candidatesById } from "../domain/candidates.js";

/**
 * Property 1 (Bug Condition -> fixed): the fallback branch serves a non-empty,
 * verified News_Dataset.
 *
 * Originally a BUGFIX EXPLORATION TEST written against the OLD x.com-post
 * design: it asserted that the fallback envelope served genuine x.com posts
 * (authorHandle matching a candidate via normalizeHandle, a sourceUrl on host
 * x.com, finite non-negative likes/reposts). That data model could not be
 * populated (x.com gates post data behind auth + a paid API), so the dataset
 * was `[]` and the test failed — the counterexample that confirmed the bug.
 *
 * The section is now a curated candidate News feed. The item model is
 * `News_Item = { id; candidateIds: string[]; title; outlet; url; date (ISO);
 * tabs: TweetTab[]; context? }`, and the fallback dataset (`tweets` in
 * server/src/domain/tweets.ts) is populated with verified records. The
 * envelope `{ posts, source }` and the cache -> live -> fallback decision tree
 * in `resolveTweets()` are unchanged; with live posting disabled the route
 * serves `{ posts: News_Item[], source: "fallback" }`.
 *
 * This test now encodes the EXPECTED (post-fix) behavior from Property 1 in
 * design.md and PASSES because the bug is fixed: with live posting disabled
 * (the bug-condition precondition — bearer token absent/empty) the fallback
 * branch serves a non-empty verified dataset with the Recent News tab
 * populated, and every served item is a Verified_Source tied to real
 * candidates.
 *
 * Validates: Requirements 2.1, 2.2, 3.1
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";

const app = createApp();

/** True exactly when `value` is a non-empty, non-whitespace string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** True when `url` parses as a URL whose protocol is http: or https:. */
function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** True when `value` is a valid ISO 8601 date string (parses to a real time). */
function isValidIsoDate(value: unknown): boolean {
  return isNonEmptyString(value) && !Number.isNaN(new Date(value).getTime());
}

/**
 * Generator for "absent or empty" credential states, which drive the fallback
 * branch (`isLivePostsEnabled()` false), i.e. the bug condition:
 *   - `undefined` models an unset environment variable, and
 *   - any whitespace-only string (including "") models a present-but-empty token.
 */
const absentOrEmptyTokenArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(""),
  fc
    .array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 8 })
    .map((chars) => chars.join("")),
);

describe("Property 1 (bug condition -> fixed): fallback serves a non-empty verified News_Dataset", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) {
      delete process.env[BEARER_TOKEN_ENV];
    } else {
      process.env[BEARER_TOKEN_ENV] = originalToken;
    }
    setCache([]);
  });

  it("serves a non-empty verified fallback dataset with the Recent News tab populated", async () => {
    await fc.assert(
      fc.asyncProperty(absentOrEmptyTokenArb, async (token) => {
        // Clean cache so the disabled branch is the only path exercised.
        setCache([]);

        // Apply the absent/empty credential state so the request resolves to
        // the fallback branch (isBugCondition facet: resolvesToFallback).
        if (token === undefined) {
          delete process.env[BEARER_TOKEN_ENV];
        } else {
          process.env[BEARER_TOKEN_ENV] = token;
        }

        // A fetch spy that would fail loudly: the disabled branch must not call
        // the network, so the served envelope comes purely from the dataset.
        const fetchSpy = vi
          .spyOn(globalThis, "fetch")
          .mockRejectedValue(new Error("fetch must not be called in disabled mode"));

        try {
          // Precondition: the bug condition holds — live posting is disabled.
          expect(isLivePostsEnabled()).toBe(false);

          const res = await request(app).get("/api/tweets");
          expect(res.status).toBe(200);

          // Expected behavior (Property 1, post-fix): the fallback branch serves
          // a non-empty verified News_Dataset.
          expect(res.body.source).toBe("fallback");
          expect(Array.isArray(res.body.posts)).toBe(true);
          expect(res.body.posts.length).toBeGreaterThanOrEqual(1);

          // At least one served item is on the Recent News tab, so Recent News
          // is populated instead of showing the empty state (Req 2.1, 2.2).
          const hasRecent = res.body.posts.some(
            (p: { tabs?: unknown[] }) => Array.isArray(p.tabs) && p.tabs.includes("recent"),
          );
          expect(hasRecent).toBe(true);

          // Every served item is a Verified_Source tied to real candidates.
          for (const post of res.body.posts) {
            expect(isNonEmptyString(post.title)).toBe(true);
            expect(isNonEmptyString(post.outlet)).toBe(true);
            expect(isNonEmptyString(post.url)).toBe(true);
            expect(isValidIsoDate(post.date)).toBe(true);
            expect(isHttpUrl(post.url)).toBe(true);

            // candidateIds is non-empty, has no duplicates, and every id
            // resolves to a real candidate in candidatesById.
            expect(Array.isArray(post.candidateIds)).toBe(true);
            expect(post.candidateIds.length).toBeGreaterThanOrEqual(1);
            expect(new Set(post.candidateIds).size).toBe(post.candidateIds.length);
            for (const id of post.candidateIds) {
              expect(candidatesById.has(id)).toBe(true);
            }

            // Interactions-tab items are inherently multi-candidate (Req 2.6
            // invariant preserved on the served dataset).
            if (Array.isArray(post.tabs) && post.tabs.includes("interactions")) {
              expect(post.candidateIds.length).toBeGreaterThanOrEqual(2);
            }
          }

          // The disabled branch never touches the network.
          expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
          fetchSpy.mockRestore();
        }
      }),
      { numRuns: 100 },
    );
  });
});
