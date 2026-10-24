import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { setCache, isFresh } from "./cache.js";
import type { Tweet } from "../domain/types.js";

/**
 * Property 10 (unit-level portion): Fresh cache is served without an external call.
 *
 * For any non-empty cache populated via `setCache(posts, fetchedAt)` and any
 * configured lifetime in seconds, `isFresh(lifetime, now)` is true exactly when
 * the cache age `(now - fetchedAt) / 1000` is within the lifetime (i.e. age <=
 * lifetime, matching Req 6.2's "less than or equal to" boundary) and false once
 * the age exceeds the lifetime. We exercise offsets right around the boundary —
 * at the lifetime, just below it, and just above it — using an explicit `now`
 * so the freshness check is fully deterministic (no wall-clock dependence).
 *
 * Validates: Requirements 6.2, 10.3
 */

/** A single `Tweet`, kept minimal but inside the declared shape. */
const tweetArb: fc.Arbitrary<Tweet> = fc.record({
  id: fc.string(),
  candidateId: fc.string(),
  authorName: fc.string(),
  authorHandle: fc.string(),
  text: fc.string(),
  date: fc
    .integer({ min: 946_684_800_000, max: 4_102_444_800_000 })
    .map((ms) => new Date(ms).toISOString()),
  likes: fc.nat(),
  reposts: fc.nat(),
  tabs: fc.array(
    fc.constantFrom("recent", "notable", "needsContext", "interactions"),
  ) as fc.Arbitrary<Tweet["tabs"]>,
});

/** A guaranteed non-empty list of posts so the cache is populated. */
const nonEmptyPostsArb = fc.array(tweetArb, { minLength: 1, maxLength: 10 });

/** Retrieval timestamp (UTC epoch ms), bounded so now + offset stays in range. */
const fetchedAtArb = fc.integer({ min: 0, max: 8_000_000_000_000 });

/** Lifetime in seconds, within the valid clamped config range [1, 86400]. */
const lifetimeArb = fc.integer({ min: 1, max: 86_400 });

describe("Property 10: fresh cache freshness boundary (isFresh)", () => {
  it("is true within the lifetime and false once age exceeds it, around the boundary", () => {
    fc.assert(
      fc.property(
        nonEmptyPostsArb,
        fetchedAtArb,
        lifetimeArb,
        (posts, fetchedAt, lifetimeSeconds) => {
          setCache(posts, fetchedAt);

          const lifetimeMs = lifetimeSeconds * 1000;

          // Exactly at the boundary: age == lifetime -> fresh (age <= lifetime).
          const atNow = fetchedAt + lifetimeMs;
          expect(isFresh(lifetimeSeconds, atNow)).toBe(true);

          // Just below the boundary: still fresh.
          const belowNow = fetchedAt + lifetimeMs - 1;
          expect(isFresh(lifetimeSeconds, belowNow)).toBe(true);

          // Just above the boundary: stale (age > lifetime).
          const aboveNow = fetchedAt + lifetimeMs + 1;
          expect(isFresh(lifetimeSeconds, aboveNow)).toBe(false);

          // The retrieval instant itself (age 0) is always fresh.
          expect(isFresh(lifetimeSeconds, fetchedAt)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("matches the age <= lifetime predicate for an arbitrary offset", () => {
    // Offsets span well below and well above any lifetime so both branches
    // are exercised across the generated space.
    const offsetMsArb = fc.integer({ min: 0, max: 200_000_000 });

    fc.assert(
      fc.property(
        nonEmptyPostsArb,
        fetchedAtArb,
        lifetimeArb,
        offsetMsArb,
        (posts, fetchedAt, lifetimeSeconds, offsetMs) => {
          setCache(posts, fetchedAt);

          const now = fetchedAt + offsetMs;
          const ageSeconds = offsetMs / 1000;
          const expected = ageSeconds <= lifetimeSeconds;

          expect(isFresh(lifetimeSeconds, now)).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
