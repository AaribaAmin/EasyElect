import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { setCache, getCache } from "./cache.js";
import type { Tweet } from "../domain/types.js";

/**
 * Property 12: Cache store round-trips posts with a UTC timestamp.
 *
 * For any list of posts, calling `setCache(posts, now)` and then `getCache()`
 * returns an entry whose `posts` are exactly the stored posts and whose
 * `fetchedAt` is the UTC epoch-ms timestamp captured at the store moment. When
 * no explicit `now` is provided, `fetchedAt` is captured from the wall clock at
 * store time (i.e. close to `Date.now()`).
 *
 * Validates: Requirements 6.1
 */

/** Generator for an arbitrary `Tweet`, staying inside the declared shape. */
const tabArb = fc.constantFrom(
  "recent",
  "notable",
  "needsContext",
  "interactions",
) as fc.Arbitrary<Tweet["tabs"][number]>;

const tweetArb: fc.Arbitrary<Tweet> = fc.record({
  id: fc.string(),
  candidateId: fc.string(),
  authorName: fc.string(),
  authorHandle: fc.string(),
  text: fc.string(),
  date: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
  likes: fc.nat(),
  reposts: fc.nat(),
  tabs: fc.array(tabArb),
});

const postsArb = fc.array(tweetArb, { maxLength: 20 });

/** Non-negative integer epoch-ms timestamp (UTC). */
const nowArb = fc.integer({ min: 0, max: 8640000000000000 });

describe("Property 12: cache store round-trips posts with a UTC timestamp", () => {
  it("round-trips posts and the explicit UTC timestamp", () => {
    fc.assert(
      fc.property(postsArb, nowArb, (posts, now) => {
        setCache(posts, now);
        const entry = getCache();

        expect(entry).not.toBeNull();
        // Posts round-trip exactly (same elements, same order).
        expect(entry!.posts).toEqual(posts);
        // fetchedAt is the UTC epoch-ms timestamp captured at store time.
        expect(entry!.fetchedAt).toBe(now);
        expect(Number.isInteger(entry!.fetchedAt)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("stamps fetchedAt from the wall clock when no now is given", () => {
    fc.assert(
      fc.property(postsArb, (posts) => {
        const before = Date.now();
        setCache(posts);
        const after = Date.now();
        const entry = getCache();

        expect(entry).not.toBeNull();
        expect(entry!.posts).toEqual(posts);
        // Captured at the store moment: within the surrounding Date.now() window.
        expect(entry!.fetchedAt).toBeGreaterThanOrEqual(before);
        expect(entry!.fetchedAt).toBeLessThanOrEqual(after);
      }),
      { numRuns: 200 },
    );
  });
});
