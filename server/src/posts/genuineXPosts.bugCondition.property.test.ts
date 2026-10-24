import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import { fetchLivePosts, type FetchLiveDeps } from "./provider.js";
import { tweets } from "../domain/tweets.js";
import type { Candidate, Tweet } from "../domain/types.js";

/**
 * Property 1 (Bug Condition): Only genuine x.com posts are displayed.
 *
 * BUGFIX EXPLORATION TEST — this test MUST FAIL on the unfixed code. Each
 * failure is a counterexample that confirms the root-cause analysis in
 * design.md. DO NOT "fix" this test or the code to make it pass; the fix tasks
 * will make it pass later.
 *
 * A served post is genuine only when it is a real, publicly published x.com
 * post: its back-link (`sourceUrl`) resolves to that post on the `x.com` host
 * AND its `likes`/`reposts` are the real counts obtained from that post. The
 * bug condition holds when a displayed post is NOT genuine:
 *
 *   isBugCondition(input) =
 *     postIsDisplayed(input.post, input.source)
 *     AND NOT ( hostOf(input.post.sourceUrl) === "x.com"
 *               AND engagementCountsAreReal(input.post) )
 *
 * This test surfaces the three concrete defects:
 *   (a) Fallback dataset back-links are on non-x.com hosts (mass.gov, wbur.org,
 *       bostonglobe.com, nbcboston.com, cbsnews.com, yahoo.com, campaign site).
 *   (b) Fallback dataset engagement counts are display-only placeholders, not
 *       counts obtained from a real x.com post.
 *   (c) The live adapter builds its back-link on the `twitter.com` host rather
 *       than `x.com`.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";

/**
 * Parse the host of a back-link URL. Returns the lowercased host with any
 * leading "www." stripped, or null when the value is not a parseable URL.
 * A genuine post's host is exactly "x.com".
 */
function hostOf(sourceUrl: string | undefined): string | null {
  if (typeof sourceUrl !== "string" || sourceUrl.trim().length === 0) {
    return null;
  }
  try {
    const host = new URL(sourceUrl).host.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/**
 * The fallback dataset documents its likes/reposts as "display-only
 * placeholders" where real counts are unavailable — i.e. they were never
 * obtained from a real x.com post. For the fallback source, no engagement
 * count can be treated as real, so this is always false there.
 */
function engagementCountsAreReal(_post: Tweet, source: "fallback" | "live"): boolean {
  // Fallback counts are documented placeholders; live counts come from the
  // source's public_metrics. The genuineness bar for the fallback path is that
  // there are no placeholder counts being displayed at all.
  return source !== "fallback";
}

/** A minimal, structurally valid candidate carrying a handle. */
function makeCandidate(id: string, handle: string): Candidate {
  return {
    id,
    name: `Candidate ${id}`,
    party: "Independent",
    office: "Governor",
    district: "Massachusetts",
    tagline: "A tagline",
    bio: { simple: "simple bio", expert: "expert bio" },
    stances: [],
    handle,
    source: {
      name: "Test Source",
      url: "https://example.com",
      reviewedOn: "2024-01-01",
    },
  };
}

/** A fetch stub that returns a fixed vendor (X v2-style) JSON body, HTTP 200. */
function stubFetchReturning(body: unknown): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => body,
    }) as unknown as Response) as unknown as typeof fetch;
}

describe("Property 1 (bug condition): only genuine x.com posts are displayed", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env[BEARER_TOKEN_ENV];
    } else {
      process.env[BEARER_TOKEN_ENV] = originalToken;
    }
  });

  // --- Test case (a): fallback back-link host must be x.com -----------------
  // Scoped PBT: the fallback dataset is fixed, so range over its real records.
  it("(a) every served fallback post has an x.com back-link host", () => {
    // Guard: if the dataset is empty the property is vacuously true, so skip
    // the fast-check draw (fc.constantFrom requires at least one value).
    if (tweets.length === 0) return;
    fc.assert(
      fc.property(fc.constantFrom(...tweets), (post) => {
        // isBugCondition facet: displayed fallback post whose host != x.com.
        expect(hostOf(post.sourceUrl)).toBe("x.com");
      }),
      { numRuns: 200 },
    );
  });

  // --- Test case (b): fallback counts must be real, not placeholders --------
  it("(b) no served fallback post carries placeholder engagement counts", () => {
    if (tweets.length === 0) return;
    fc.assert(
      fc.property(fc.constantFrom(...tweets), (post) => {
        // A genuine fallback post would have real counts AND an x.com host.
        // The dataset documents its counts as display-only placeholders, so a
        // genuine fallback record cannot exist while those placeholders remain.
        const isGenuine =
          hostOf(post.sourceUrl) === "x.com" &&
          engagementCountsAreReal(post, "fallback");
        expect(isGenuine).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  // --- Test case (c): live adapter back-link host must be x.com -------------
  // The live adapter (adaptRawResponse) is exercised end-to-end through
  // fetchLivePosts with a stubbed vendor response. Generate handles/ids and
  // assert the mapped post's back-link resolves to the x.com host.
  it("(c) the live adapter builds back-links on the x.com host", async () => {
    process.env[BEARER_TOKEN_ENV] = "test-bearer-token";

    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z0-9_]{1,15}$/),
        fc.stringMatching(/^[0-9]{5,19}$/),
        fc.nat({ max: 100000 }),
        fc.nat({ max: 100000 }),
        async (handle, id, likes, reposts) => {
          const candidates = [makeCandidate("cand-1", `@${handle}`)];

          // A representative X v2-style search response for this handle/id.
          const vendorBody = {
            data: [
              {
                id,
                text: `A public statement from @${handle}`,
                created_at: "2026-01-01T00:00:00.000Z",
                author_id: "author-1",
                possibly_sensitive: false,
                public_metrics: { like_count: likes, retweet_count: reposts },
              },
            ],
            includes: {
              users: [
                {
                  id: "author-1",
                  name: `Author ${handle}`,
                  username: handle,
                  protected: false,
                },
              ],
            },
          };

          const deps: FetchLiveDeps = { fetchFn: stubFetchReturning(vendorBody) };
          const outcome = await fetchLivePosts(candidates, deps);

          expect(outcome.kind).toBe("ok");
          if (outcome.kind !== "ok") return;
          expect(outcome.posts.length).toBe(1);

          const mapped = outcome.posts[0];
          // isBugCondition facet: the mapped back-link host must be x.com.
          expect(hostOf(mapped.sourceUrl)).toBe("x.com");
        },
      ),
      { numRuns: 50 },
    );
  });
});
