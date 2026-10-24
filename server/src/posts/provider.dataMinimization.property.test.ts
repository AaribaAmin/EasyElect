import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mapRawPost, normalizeHandle, type RawPost } from "./provider.js";
import type { Candidate, Tweet } from "../domain/types.js";

/**
 * Property 6: Mapped posts carry no personal data beyond the allowed set.
 *
 * `mapRawPost` copies only the public author identity (`authorName`,
 * `authorHandle`) and public post content into a `Tweet` (Req 11.5). No other
 * personal field the source may carry — email, phone, geolocation, a device
 * id, anything — is read or stored.
 *
 * This test generates a valid raw post (public, fully attributed, and matching
 * a candidate handle so the mapper returns a `Tweet` rather than `null`) and
 * then injects arbitrary EXTRA keys onto the raw input, including named
 * personal fields (`email`, `phone`, `location`) and random keys. It asserts
 * that the mapped `Tweet`'s key set is always a subset of the declared `Tweet`
 * field set — i.e. none of the injected extra keys leak through.
 *
 * Validates: Requirements 11.5
 */

/** The complete declared `Tweet` field set (required + optional). */
const DECLARED_TWEET_KEYS = new Set<keyof Tweet>([
  "id",
  "candidateId",
  "authorName",
  "authorHandle",
  "text",
  "date",
  "likes",
  "reposts",
  "tabs",
  "context",
  "inReplyTo",
  "sourceUrl",
]);

/** A non-empty, non-whitespace string (the mapper requires these for attribution). */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0);

/** A handle that survives normalization to a stable, non-empty value. */
const handleArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => normalizeHandle(s).trim().length > 0);

/**
 * Arbitrary extra keys that must never appear on a mapped `Tweet`. Includes the
 * personal fields called out in the task (email, phone, location) plus random
 * keys, with arbitrary values. Keys that collide with declared `Tweet` fields
 * are filtered out so an injected key is genuinely "extra".
 */
const extraKeysArb = fc.dictionary(
  fc
    .oneof(
      fc.constantFrom(
        "email",
        "phone",
        "location",
        "geo",
        "ipAddress",
        "deviceId",
        "ssn",
        "dateOfBirth",
      ),
      fc.string({ minLength: 1, maxLength: 12 }),
    )
    .filter((k) => !DECLARED_TWEET_KEYS.has(k as keyof Tweet)),
  fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
  { maxKeys: 8 },
);

describe("Property 6: mapped posts carry no personal data beyond the allowed set", () => {
  it("never copies extra/personal keys onto the mapped Tweet", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb, // id
        nonEmptyStringArb, // text
        nonEmptyStringArb, // authorName
        handleArb, // authorHandle (also used for candidate match)
        nonEmptyStringArb, // url / sourceUrl
        fc.nat(), // likes
        fc.nat(), // reposts
        extraKeysArb, // injected extra keys
        (id, text, authorName, handle, url, likes, reposts, extras) => {
          // A candidate whose handle matches the post's author handle, so the
          // post is attributed and the mapper returns a Tweet.
          const candidate: Candidate = {
            id: "cand-1",
            name: "Test Candidate",
            party: "Independent",
            office: "Governor",
            district: "Massachusetts",
            tagline: "t",
            bio: { simple: "s", expert: "e" },
            stances: [],
            handle,
            source: {
              name: "src",
              url: "https://example.com",
              reviewedOn: "2024-01-01",
            },
          };

          // A valid raw post, then spread arbitrary extra keys on top. The
          // extras include personal fields that must not leak into the Tweet.
          const raw = {
            ...extras,
            id,
            text,
            authorName,
            authorHandle: handle,
            url,
            isPublic: true,
            likes,
            reposts,
          } as RawPost;

          const tweet = mapRawPost(raw, [candidate]);

          // The raw post is valid, so a Tweet must be produced.
          expect(tweet).not.toBeNull();

          // Every key on the mapped Tweet is a declared Tweet field — no
          // injected extra/personal key leaked through.
          for (const key of Object.keys(tweet as Tweet)) {
            expect(DECLARED_TWEET_KEYS.has(key as keyof Tweet)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
