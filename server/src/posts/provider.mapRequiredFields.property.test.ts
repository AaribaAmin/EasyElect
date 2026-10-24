import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mapRawPost, normalizeHandle, type RawPost } from "./provider.js";
import type { Candidate, SourceAttribution } from "../domain/types.js";

/**
 * Property 3: Post mapping populates required fields and preserves the source URL.
 *
 * For any VALID raw post — one the mapper accepts: public-publication confirmed,
 * an author handle that matches a candidate, and non-empty required fields
 * (`id`, `text`, `authorName`, `authorHandle`, `url`) — the mapped `Tweet`:
 *
 *   - has a `string` `id`,
 *   - has non-empty `text`,
 *   - has a `date` that is a valid ISO-8601 string (parses to a real date and
 *     round-trips through `Date.prototype.toISOString`),
 *   - has numeric `likes` and `reposts`,
 *   - has an array `tabs`, and
 *   - has `sourceUrl` exactly equal to the raw post's original `url`.
 *
 * Generators build a set of candidates (each with a handle) and then construct
 * RawPosts whose `authorHandle` matches one of those candidate handles (with
 * arbitrary case / leading-@ variation, since matching is case/@-insensitive)
 * and whose `isPublic` is true, so every generated raw post is one the mapper
 * must accept and map (never drop).
 *
 * Validates: Requirements 4.2, 4.4
 */

/** A minimal non-empty SourceAttribution; candidate `source` is required. */
const sourceArb: fc.Arbitrary<SourceAttribution> = fc.record({
  name: fc.constant("Example Source"),
  url: fc.constant("https://example.com"),
  reviewedOn: fc.constant("2024-01-01"),
});

/** A non-empty, trimmed handle string (letters/digits/underscore). */
const bareHandleArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9_]{1,20}$/)
  .filter((s) => s.trim().length > 0);

/** Build a candidate carrying a given handle; other fields are placeholders. */
function makeCandidate(id: string, handle: string): Candidate {
  return {
    id,
    name: `Candidate ${id}`,
    party: "Democratic",
    office: "State Senate",
    district: "Massachusetts",
    tagline: "A tagline",
    bio: { simple: "simple bio", expert: "expert bio" },
    stances: [],
    handle,
    source: {
      name: "Example Source",
      url: "https://example.com",
      reviewedOn: "2024-01-01",
    },
  };
}

/** A non-empty, trimmed free-text string (used for text / authorName). */
const nonEmptyTextArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0);

/** A resolvable-looking source URL; preserved verbatim as `sourceUrl`. */
const urlArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z0-9-]{1,30}$/)
  .map((slug) => `https://social.example/${slug}/status/123`);

/** Apply arbitrary case / optional single leading "@" to an author handle. */
function varyHandle(handle: string, upper: boolean, at: boolean): string {
  const cased = upper ? handle.toUpperCase() : handle.toLowerCase();
  return at ? `@${cased}` : cased;
}

describe("Property 3: post mapping populates required fields and preserves the source URL", () => {
  it("maps every valid raw post to a Tweet with the required fields and verbatim sourceUrl", () => {
    // A set of 1..6 candidates with distinct normalized handles.
    const candidatesArb = fc
      .uniqueArray(bareHandleArb, {
        minLength: 1,
        maxLength: 6,
        selector: (h) => normalizeHandle(h),
      })
      .map((handles) =>
        handles.map((h, i) => makeCandidate(`cand-${i}`, h)),
      );

    fc.assert(
      fc.property(
        candidatesArb,
        fc.nat(),
        fc.boolean(),
        fc.boolean(),
        nonEmptyTextArb, // text
        nonEmptyTextArb, // authorName
        fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0), // id
        urlArb,
        fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: undefined }), // likes
        fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: undefined }), // reposts
        fc.option(fc.date(), { nil: undefined }), // createdAt source
        (
          candidates,
          targetIdx,
          upperCase,
          withAt,
          text,
          authorName,
          id,
          url,
          likes,
          reposts,
          createdAtDate,
        ) => {
          const target = candidates[targetIdx % candidates.length];
          // target.handle is always defined by construction.
          const authorHandle = varyHandle(target.handle!, upperCase, withAt);

          const createdAt =
            createdAtDate && !Number.isNaN(createdAtDate.getTime())
              ? createdAtDate.toISOString()
              : undefined;

          const raw: RawPost = {
            id,
            text,
            authorName,
            authorHandle,
            url,
            isPublic: true,
            likes,
            reposts,
            createdAt,
          };

          const tweet = mapRawPost(raw, candidates);

          // A valid raw post must map (never be dropped).
          expect(tweet).not.toBeNull();
          if (!tweet) return;

          // id is a string.
          expect(typeof tweet.id).toBe("string");

          // text is non-empty.
          expect(typeof tweet.text).toBe("string");
          expect(tweet.text.trim().length).toBeGreaterThan(0);

          // date is a valid ISO-8601 string that round-trips.
          expect(typeof tweet.date).toBe("string");
          const parsed = new Date(tweet.date);
          expect(Number.isNaN(parsed.getTime())).toBe(false);
          expect(parsed.toISOString()).toBe(tweet.date);

          // likes / reposts are numbers.
          expect(typeof tweet.likes).toBe("number");
          expect(Number.isFinite(tweet.likes)).toBe(true);
          expect(typeof tweet.reposts).toBe("number");
          expect(Number.isFinite(tweet.reposts)).toBe(true);

          // tabs is an array.
          expect(Array.isArray(tweet.tabs)).toBe(true);

          // sourceUrl is exactly the raw post's original url (Req 4.4).
          expect(tweet.sourceUrl).toBe(raw.url);

          // candidateId attributes to the matched candidate (Req 4.3 support).
          expect(tweet.candidateId).toBe(target.id);
        },
      ),
      { numRuns: 200 },
    );
  });
});
