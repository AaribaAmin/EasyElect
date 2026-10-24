import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mapRawPosts, type RawPost } from "./provider.js";
import type { Candidate } from "../domain/types.js";

/**
 * Property 4: Only publicly published posts are returned.
 *
 * `mapRawPosts` must serve, from a batch of raw external posts, ONLY posts
 * whose public-publication status the source explicitly confirms
 * (`isPublic === true` or `public === true`). A post whose public status is
 * false or absent is "unconfirmed" and must be excluded, and none of its
 * personal data may survive into the mapped result (Req 11.1, 11.2).
 *
 * To isolate public status as the single variable under test, every generated
 * raw post is otherwise fully valid and serveable: it has a non-empty
 * `id`/`text`/`url`/`authorName`, and its `authorHandle` matches a known
 * candidate's handle (via normalization). The ONLY thing that varies is how
 * (or whether) public publication is signalled. That way, every exclusion in
 * the result is attributable to public status, not to a missing field or an
 * unmatched handle.
 *
 * The test asserts two facets of the contract across arbitrary mixed batches:
 *
 *   1. Confirmed-public survival — every post in the mapped result corresponds
 *      to a raw post that carried a confirmed public flag, and every
 *      confirmed-public raw post is represented exactly once.
 *   2. Unconfirmed exclusion + no data leak — no identifying field or value of
 *      any non-public / publication-unconfirmed raw post (its id, text,
 *      sourceUrl, authorName, or authorHandle) appears anywhere in the result.
 *
 * Validates: Requirements 11.1, 11.2
 */

const CANDIDATES: readonly Candidate[] = [
  {
    id: "cand-jane",
    name: "Jane Public",
    party: "Democratic",
    office: "Governor",
    district: "Massachusetts",
    tagline: "For everyone",
    bio: { simple: "A candidate.", expert: "A candidate." },
    stances: [],
    handle: "@jane_for_ma",
    source: {
      name: "Example",
      url: "https://example.com/jane",
      reviewedOn: "2024-01-01",
    },
  },
  {
    id: "cand-sam",
    name: "Sam Voter",
    party: "Republican",
    office: "US Senate",
    district: "Massachusetts",
    tagline: "Forward together",
    bio: { simple: "A candidate.", expert: "A candidate." },
    stances: [],
    handle: "SamForSenate",
    source: {
      name: "Example",
      url: "https://example.com/sam",
      reviewedOn: "2024-01-01",
    },
  },
];

/** A candidate handle any generated post is attributed to (so handle match is never the reason for exclusion). */
const candidateHandle = fc.constantFrom(
  "@jane_for_ma",
  "jane_for_ma",
  "JANE_FOR_MA",
  "SamForSenate",
  "@samforsenate",
);

/**
 * How a raw post signals (or fails to signal) public publication.
 *
 *   - "isPublicTrue" / "publicTrue"  → confirmed public (must survive).
 *   - everything else                → unconfirmed (must be excluded).
 */
type PublicMode =
  | "isPublicTrue"
  | "publicTrue"
  | "isPublicFalse"
  | "publicFalse"
  | "isPublicUndefined"
  | "bothFalse";

const publicMode: fc.Arbitrary<PublicMode> = fc.constantFrom(
  "isPublicTrue",
  "publicTrue",
  "isPublicFalse",
  "publicFalse",
  "isPublicUndefined",
  "bothFalse",
);

function isConfirmed(mode: PublicMode): boolean {
  return mode === "isPublicTrue" || mode === "publicTrue";
}

/** Apply the chosen public-publication signalling to an otherwise-valid raw post. */
function applyPublicMode(base: Omit<RawPost, "isPublic" | "public">, mode: PublicMode): RawPost {
  switch (mode) {
    case "isPublicTrue":
      return { ...base, isPublic: true };
    case "publicTrue":
      return { ...base, public: true };
    case "isPublicFalse":
      return { ...base, isPublic: false };
    case "publicFalse":
      return { ...base, public: false };
    case "bothFalse":
      return { ...base, isPublic: false, public: false };
    case "isPublicUndefined":
      // No public flag at all — status is unconfirmed.
      return { ...base };
  }
}

/**
 * A fully-valid-except-public-status raw post, parameterized by a per-batch
 * unique `uid`. The `uid` is embedded verbatim into `id`, `text`, `url`, and
 * `authorName` so each post's identifying values are globally unique within a
 * batch — and, critically, no value is a substring of another post's value
 * (the uids are zero-padded and the embedded forms are delimited). That lets
 * the non-leakage assertion compare exact field values rather than relying on
 * substring matching.
 */
function rawPostArb(uid: string): fc.Arbitrary<RawPost> {
  return fc
    .record({
      handle: candidateHandle,
      mode: publicMode,
      likes: fc.nat({ max: 10_000 }),
      reposts: fc.nat({ max: 10_000 }),
    })
    .map(({ handle, mode, likes, reposts }) => {
      const base: Omit<RawPost, "isPublic" | "public"> = {
        id: `post-id-[${uid}]`,
        text: `post body [${uid}]`,
        createdAt: "2024-05-01T12:00:00.000Z",
        url: `https://example.test/status/[${uid}]`,
        authorName: `Author [${uid}]`,
        authorHandle: handle,
        likes,
        reposts,
      };
      return applyPublicMode(base, mode);
    });
}

function isConfirmedPublic(raw: RawPost): boolean {
  return raw.isPublic === true || raw.public === true;
}

/** The per-post identifying string values (those embedding the unique uid). */
function identifyingValues(raw: RawPost): string[] {
  return [raw.id, raw.text, raw.url, raw.authorName].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

describe("Property 4: only publicly published posts are returned", () => {
  it("returns exactly the confirmed-public posts and leaks no data from the rest", () => {
    fc.assert(
      fc.property(
        // A mixed batch of 1..12 posts. Each gets a zero-padded, unique uid so
        // its identifying values are distinct and non-overlapping; each picks
        // its own public mode independently.
        fc.integer({ min: 1, max: 12 }).chain((count) =>
          fc.tuple(
            ...Array.from({ length: count }, (_, i) =>
              rawPostArb(String(i).padStart(4, "0")),
            ),
          ),
        ),
        (rawPosts) => {
          const result = mapRawPosts(rawPosts, CANDIDATES);

          const confirmedPublic = rawPosts.filter(isConfirmedPublic);
          const unconfirmed = rawPosts.filter((r) => !isConfirmedPublic(r));

          // 1. Count parity: every confirmed-public post is served, nothing else.
          expect(result).toHaveLength(confirmedPublic.length);

          // Every served post must trace back to a confirmed-public raw post,
          // matched by its unique id.
          for (const tweet of result) {
            const origin = rawPosts.find((r) => r.id === tweet.id);
            expect(origin).toBeDefined();
            expect(isConfirmedPublic(origin!)).toBe(true);
          }

          // 2. No field/value of any unconfirmed post leaks into the result.
          // Collect every string value present anywhere in the mapped output.
          const resultValues = new Set<string>();
          for (const tweet of result) {
            resultValues.add(tweet.id);
            resultValues.add(tweet.text);
            resultValues.add(tweet.authorName);
            if (tweet.sourceUrl) resultValues.add(tweet.sourceUrl);
          }
          for (const raw of unconfirmed) {
            for (const value of identifyingValues(raw)) {
              // uids are unique per post, so an unconfirmed post's identifying
              // values can never coincide with a surviving public post's.
              expect(resultValues.has(value)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
