import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mapRawPosts, normalizeHandle, type RawPost } from "./provider.js";
import type { Candidate } from "../domain/types.js";

/**
 * Property 2: Posts from unmatched handles are excluded; matched posts get the
 * correct candidateId.
 *
 * `mapRawPosts` attributes each raw post to the candidate whose `handle`
 * matches the post's author handle under `normalizeHandle` (case- and
 * @-insensitive), and drops any post whose author matches no candidate.
 *
 * To isolate handle matching as the single variable under test, every raw post
 * fixture is constructed to pass all of the OTHER mapper gates: `isPublic` is
 * `true`, and `text`/`id`/`url`/`authorName` are all non-empty. The only thing
 * that varies between "kept" and "dropped" is whether the author handle matches
 * a candidate handle.
 *
 * This test asserts both facets:
 *   1. Attribution correctness — for every post in the mapped result, the
 *      author's normalized handle equals the normalized handle of the candidate
 *      named by its `candidateId`.
 *   2. Exclusion — every raw post whose normalized author handle matches no
 *      candidate handle is absent from the result.
 *
 * Validates: Requirements 4.3, 4.5
 */

/** Build a minimal, structurally valid Candidate carrying the given id + handle. */
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

/**
 * Build a RawPost that passes every mapper gate EXCEPT handle matching: it is
 * explicitly public and carries non-empty id/text/url/authorName. The author
 * handle is the only variable the caller controls.
 */
function makeRawPost(index: number, authorHandle: string): RawPost {
  return {
    id: `post-${index}`,
    text: `post text ${index}`,
    createdAt: "2024-01-01T00:00:00.000Z",
    url: `https://example.com/post/${index}`,
    authorName: `Author ${index}`,
    authorHandle,
    isPublic: true,
    likes: 1,
    reposts: 2,
  };
}

/**
 * A handle body (no leading "@") that normalizes to a non-empty string. We keep
 * the alphabet simple so generated handles are realistic social handles and so
 * `normalizeHandle` (lowercase + strip one leading "@") has observable effect.
 */
const handleBodyArb = fc
  .stringMatching(/^[A-Za-z0-9_]{1,20}$/)
  .filter((s) => normalizeHandle(s).length > 0);

/** Optionally decorate a handle body with a leading "@" and random casing. */
const decoratedHandleArb = (body: string): fc.Arbitrary<string> =>
  fc.tuple(fc.boolean(), fc.boolean()).map(([at, upper]) => {
    const cased = upper ? body.toUpperCase() : body.toLowerCase();
    return at ? `@${cased}` : cased;
  });

describe("Property 2: unmatched handles excluded; matched posts get correct candidateId", () => {
  it("attributes matched posts correctly and excludes unmatched ones", () => {
    fc.assert(
      fc.property(
        // A set of candidate handle bodies, unique under normalization so each
        // maps to exactly one candidate.
        fc
          .uniqueArray(handleBodyArb, {
            minLength: 1,
            maxLength: 6,
            selector: (b) => normalizeHandle(b),
          })
          // For each raw post: pick an author handle body + whether it should
          // match a candidate, plus decoration (leading @, casing).
          .chain((candidateBodies) => {
            const normalizedSet = new Set(
              candidateBodies.map((b) => normalizeHandle(b)),
            );
            // A handle body guaranteed NOT to match any candidate.
            const nonMatchingBodyArb = handleBodyArb.filter(
              (b) => !normalizedSet.has(normalizeHandle(b)),
            );
            const postPlanArb = fc
              .boolean()
              .chain((shouldMatch) =>
                (shouldMatch
                  ? fc.constantFrom(...candidateBodies)
                  : nonMatchingBodyArb
                ).chain((body) => decoratedHandleArb(body)),
              );
            return fc.tuple(
              fc.constant(candidateBodies),
              fc.array(postPlanArb, { maxLength: 30 }),
            );
          }),
        ([candidateBodies, authorHandles]) => {
          const candidates = candidateBodies.map((body, i) =>
            makeCandidate(`cand-${i}`, body),
          );
          const rawPosts = authorHandles.map((handle, i) =>
            makeRawPost(i, handle),
          );

          const result = mapRawPosts(rawPosts, candidates);

          const candidateById = new Map(candidates.map((c) => [c.id, c]));
          const candidateNormalizedHandles = new Set(
            candidates.map((c) => normalizeHandle(c.handle!)),
          );

          // Facet 1: every mapped post is attributed to a candidate whose
          // normalized handle equals the post author's normalized handle.
          for (const tweet of result) {
            const candidate = candidateById.get(tweet.candidateId);
            expect(candidate).toBeDefined();
            expect(normalizeHandle(tweet.authorHandle)).toBe(
              normalizeHandle(candidate!.handle!),
            );
          }

          // Facet 2: every raw post whose normalized author handle matches no
          // candidate handle is absent from the result. We count matched vs.
          // unmatched raw posts and assert the kept count equals the matched
          // count — since each matched post here is otherwise fully valid, all
          // matched posts are kept and all unmatched posts are dropped.
          const matchedCount = rawPosts.filter((p) =>
            candidateNormalizedHandles.has(normalizeHandle(p.authorHandle!)),
          ).length;
          expect(result.length).toBe(matchedCount);

          // No kept post may originate from an unmatched handle.
          for (const tweet of result) {
            expect(
              candidateNormalizedHandles.has(
                normalizeHandle(tweet.authorHandle),
              ),
            ).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
