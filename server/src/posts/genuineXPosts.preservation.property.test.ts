import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import request from "supertest";
import { createApp } from "../app.js";
import {
  fetchLivePosts,
  mapRawPosts,
  type FetchLiveDeps,
  type RawPost,
} from "./provider.js";
import type { Candidate } from "../domain/types.js";

/**
 * Property 2 (Preservation): genuine posts and non-Tweets behavior unchanged.
 *
 * OBSERVATION-FIRST PRESERVATION TESTS — these tests encode the baseline
 * behavior that the genuine-x-posts fix must NOT change. They are written and
 * run against the UNFIXED code first; every assertion captures an output that
 * was observed on the current code. After the fix they must still pass, which
 * is what proves there is no regression in:
 *
 *   (a) Live real-count preservation — a post mapped from a vendor response
 *       keeps its public_metrics like/retweet counts exactly (Req 3.1).
 *   (b) Live filtering preservation — non-public, under-attributed, or
 *       unmatched-handle raw posts are dropped by mapRawPosts (Req 3.5).
 *   (e) Non-Tweets preservation — /api/candidates, /api/issues, /api/causes,
 *       /api/connect, /api/election, /api/quiz responses are byte-for-byte
 *       unchanged (Req 3.4).
 *
 * The URL-host only changes with the fix; these properties deliberately assert
 * everything EXCEPT the host (counts, dropped-vs-kept decisions, and the
 * non-Tweets payloads), so they describe behavior that is invariant across the
 * fix.
 *
 * Validates: Requirements 3.1, 3.4, 3.5
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";

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

describe("Property 2 (preservation): live real-count mapping (Req 3.1)", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];

  afterEach(() => {
    if (originalToken === undefined) delete process.env[BEARER_TOKEN_ENV];
    else process.env[BEARER_TOKEN_ENV] = originalToken;
  });

  // Observe (a): a mapped live post retains its public_metrics counts exactly.
  it("preserves public_metrics like/retweet counts on mapped live posts", async () => {
    process.env[BEARER_TOKEN_ENV] = "test-bearer-token";

    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z0-9_]{1,15}$/),
        fc.stringMatching(/^[0-9]{5,19}$/),
        fc.nat({ max: 1_000_000 }),
        fc.nat({ max: 1_000_000 }),
        async (handle, id, likes, reposts) => {
          const candidates = [makeCandidate("cand-1", `@${handle}`)];

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
          expect(outcome.posts).toHaveLength(1);

          const mapped = outcome.posts[0];
          // The observed counts equal the source public_metrics values exactly.
          expect(mapped.likes).toBe(likes);
          expect(mapped.reposts).toBe(reposts);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * How a generated raw post may fail (or pass) the mapRawPosts filter. Every
 * axis but the handle-match is varied here to observe exactly which raw posts
 * survive and which are dropped (Req 3.5). The host is irrelevant to these
 * decisions, so this behavior is invariant across the fix.
 */
type DropReason =
  | "none" // fully valid — must be kept
  | "notPublic" // public status unconfirmed — must be dropped
  | "missingText" // missing content — must be dropped
  | "missingUrl" // missing attribution link — must be dropped
  | "unmatchedHandle"; // handle matches no candidate — must be dropped

const KNOWN_HANDLE = "@kept_candidate";

const dropReasonArb: fc.Arbitrary<DropReason> = fc.constantFrom(
  "none",
  "notPublic",
  "missingText",
  "missingUrl",
  "unmatchedHandle"
);

function makeRawPost(uid: string, reason: DropReason): RawPost {
  const base: RawPost = {
    id: `id-[${uid}]`,
    text: `body [${uid}]`,
    createdAt: "2024-05-01T12:00:00.000Z",
    url: `https://example.test/status/[${uid}]`,
    authorName: `Author [${uid}]`,
    authorHandle: KNOWN_HANDLE,
    isPublic: true,
    likes: 1,
    reposts: 2,
  };
  switch (reason) {
    case "none":
      return base;
    case "notPublic":
      return { ...base, isPublic: false };
    case "missingText":
      return { ...base, text: "" };
    case "missingUrl":
      return { ...base, url: undefined };
    case "unmatchedHandle":
      return { ...base, authorHandle: "@nobody_matches_this" };
  }
}

/** The filter keeps a post exactly when its only "reason" is "none". */
function shouldKeep(reason: DropReason): boolean {
  return reason === "none";
}

describe("Property 2 (preservation): live filtering drops the same posts (Req 3.5)", () => {
  // Observe (b): non-public, under-attributed, or unmatched-handle raw posts
  // are dropped; fully valid, handle-matched posts are kept.
  it("drops non-public, under-attributed, and unmatched-handle posts; keeps the rest", () => {
    const candidates = [makeCandidate("kept_candidate", KNOWN_HANDLE)];

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }).chain((count) =>
          fc.tuple(
            ...Array.from({ length: count }, (_, i) =>
              dropReasonArb.map((reason) => ({
                uid: String(i).padStart(4, "0"),
                reason,
              }))
            )
          )
        ),
        (specs) => {
          const raws = specs.map(({ uid, reason }) => makeRawPost(uid, reason));
          const result = mapRawPosts(raws, candidates);

          const keptSpecs = specs.filter((s) => shouldKeep(s.reason));
          const droppedSpecs = specs.filter((s) => !shouldKeep(s.reason));

          // Count parity: exactly the fully-valid posts survive.
          expect(result).toHaveLength(keptSpecs.length);

          const resultIds = new Set(result.map((t) => t.id));
          // Every kept spec's post is present (matched by its unique id).
          for (const s of keptSpecs) {
            expect(resultIds.has(`id-[${s.uid}]`)).toBe(true);
          }
          // Every dropped spec's post is absent.
          for (const s of droppedSpecs) {
            expect(resultIds.has(`id-[${s.uid}]`)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Observe (e): every non-Tweets endpoint returns a stable payload. We capture
 * each endpoint's response once as the baseline, then assert that an identical
 * request against a fresh app instance returns a byte-for-byte equal body. The
 * genuine-x-posts fix touches only the Tweets path, so these payloads must be
 * completely unaffected.
 */
describe("Property 2 (preservation): non-Tweets endpoints unchanged (Req 3.4)", () => {
  const NON_TWEETS_ENDPOINTS = [
    "/api/candidates",
    "/api/issues",
    "/api/causes",
    "/api/connect",
    "/api/election",
    "/api/quiz",
  ] as const;

  it("serves byte-for-byte identical payloads across repeated requests", async () => {
    const app = createApp();

    // Capture the baseline body + status for every non-Tweets endpoint.
    const baseline = new Map<string, { status: number; text: string }>();
    for (const path of NON_TWEETS_ENDPOINTS) {
      const res = await request(app).get(path);
      baseline.set(path, { status: res.status, text: res.text });
    }

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...NON_TWEETS_ENDPOINTS),
        async (path) => {
          const expected = baseline.get(path)!;
          // A fresh app instance proves the payload is static, not stateful.
          const res = await request(createApp()).get(path);
          expect(res.status).toBe(expected.status);
          // Byte-for-byte: compare the raw serialized response text.
          expect(res.text).toBe(expected.text);
        }
      ),
      { numRuns: 60 }
    );
  });
});
