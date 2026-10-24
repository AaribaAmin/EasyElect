import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mapRawPost, mapRawPosts, normalizeHandle, type RawPost } from "./provider.js";
import type { Candidate } from "../domain/types.js";

/**
 * Property 5: Every served post is fully attributed.
 *
 * For any post returned by the mapper, `authorName` is non-empty,
 * `authorHandle` is non-empty, and `sourceUrl` is a valid HTTP/HTTPS URL; and
 * for any batch of raw posts, every post missing any required attribution field
 * (`authorName`, `authorHandle`, or the original post `url`/`sourceUrl`) is
 * excluded from the result.
 *
 * The generators deliberately mix complete posts with posts that drop one of
 * the attribution fields, all sharing a candidate handle and confirmed-public
 * status, so the only reason a post can be excluded is a missing attribution
 * field — isolating the behaviour under test.
 *
 * Validates: Requirements 11.3, 11.4
 */

/** True exactly when `value` is an HTTP/HTTPS URL. */
function isValidHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/** A minimal candidate carrying only what the mapper reads (id + handle). */
function makeCandidate(id: string, handle: string): Candidate {
  return {
    id,
    name: `Candidate ${id}`,
    party: "Democratic",
    office: "State Senate",
    district: "Massachusetts",
    tagline: "",
    bio: { simple: "s", expert: "e" },
    stances: [],
    handle,
    source: {
      name: "Source",
      url: "https://example.com/source",
      reviewedOn: "2024-01-01",
    },
  };
}

// A fixed candidate whose handle every generated post will match, so that
// handle-matching never causes exclusion — only attribution completeness can.
const CANDIDATE = makeCandidate("cand-1", "@jane_for_ma");
const CANDIDATES: readonly Candidate[] = [CANDIDATE];

/** Non-empty handle string that normalizes to the candidate's handle. */
const matchingHandleArb = fc.constantFrom(
  "@jane_for_ma",
  "jane_for_ma",
  "@Jane_For_MA",
  "JANE_FOR_MA",
);

/** Non-empty text values. */
const textArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

/** Non-empty author display names. */
const nameArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

/** Valid HTTP/HTTPS source URLs. */
const urlArb = fc.webUrl({ validSchemes: ["http", "https"] });

/** A fully-attributed, confirmed-public raw post matching the candidate. */
const completePostArb: fc.Arbitrary<RawPost> = fc.record({
  id: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
  text: textArb,
  authorName: nameArb,
  authorHandle: matchingHandleArb,
  url: urlArb,
  isPublic: fc.constant(true),
  likes: fc.nat(),
  reposts: fc.nat(),
});

/**
 * A raw post that is confirmed-public and handle-matching but has exactly one
 * required attribution field blanked out (authorName, authorHandle, or url).
 * Each such post MUST be excluded by the mapper (Req 11.4).
 */
const missingAttributionPostArb: fc.Arbitrary<RawPost> = fc
  .tuple(completePostArb, fc.constantFrom("authorName", "authorHandle", "url"))
  .map(([post, dropped]) => ({ ...post, [dropped]: "" }));

describe("Property 5: every served post is fully attributed", () => {
  it("every mapped post has non-empty author name/handle and a valid HTTP(S) sourceUrl", () => {
    fc.assert(
      fc.property(fc.array(completePostArb, { maxLength: 20 }), (rawPosts) => {
        const tweets = mapRawPosts(rawPosts, CANDIDATES);
        for (const tweet of tweets) {
          expect(tweet.authorName.trim().length).toBeGreaterThan(0);
          expect(tweet.authorHandle.trim().length).toBeGreaterThan(0);
          expect(typeof tweet.sourceUrl).toBe("string");
          expect(isValidHttpUrl(tweet.sourceUrl as string)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("excludes any post missing an attribution field, keeping only complete ones", () => {
    fc.assert(
      fc.property(
        fc.array(completePostArb, { maxLength: 15 }),
        fc.array(missingAttributionPostArb, { maxLength: 15 }),
        (completePosts, incompletePosts) => {
          // Interleave complete and attribution-missing posts in one batch.
          const batch: RawPost[] = [];
          const max = Math.max(completePosts.length, incompletePosts.length);
          for (let i = 0; i < max; i++) {
            if (i < completePosts.length) batch.push(completePosts[i]);
            if (i < incompletePosts.length) batch.push(incompletePosts[i]);
          }

          const tweets = mapRawPosts(batch, CANDIDATES);

          // Inclusion: exactly the complete posts survive (same count, since
          // each complete post matches the candidate and is fully attributed).
          expect(tweets.length).toBe(completePosts.length);

          // Full attribution holds for every survivor.
          for (const tweet of tweets) {
            expect(tweet.authorName.trim().length).toBeGreaterThan(0);
            expect(tweet.authorHandle.trim().length).toBeGreaterThan(0);
            expect(isValidHttpUrl(tweet.sourceUrl as string)).toBe(true);
            expect(tweet.candidateId).toBe(CANDIDATE.id);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("drops a single post missing any one attribution field (mapRawPost returns null)", () => {
    fc.assert(
      fc.property(missingAttributionPostArb, (post) => {
        expect(mapRawPost(post, CANDIDATES)).toBeNull();
      }),
      { numRuns: 200 },
    );
  });
});
