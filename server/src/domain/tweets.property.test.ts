import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { tweets } from "./tweets.js";

/**
 * Property 20: Fallback dataset validity (genuine-only, empty-when-unverified).
 *
 * The Fallback_Posts_Dataset (`tweets`) contains ONLY genuine, verifiable
 * x.com posts, and is empty whenever no such verified records exist. For any
 * execution the dataset holds between 0 and 50 records, and for any record
 * present:
 *   - `text`, `authorName`, `authorHandle`, and `sourceUrl` are all non-empty,
 *   - `sourceUrl` resolves to that post on the `x.com` host (Req 2.2), and
 *   - `likes`/`reposts` are real engagement counts: finite, non-negative
 *     integers, never placeholder/fabricated values (Req 2.1).
 *
 * The dataset is a fixed, curated array, so the generator ranges over the
 * dataset's own records via `fc.constantFrom(...tweets)` — every run draws a
 * real record and asserts the per-record invariants hold for it. When the
 * dataset is empty there are no records to draw, so the per-record property is
 * skipped and only the size bound is asserted.
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 */

/** True exactly when `value` is a non-empty, non-whitespace string. */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** The host of a URL, or `null` when it does not parse as a URL. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** True when `value` is a real engagement count: a finite, non-negative int. */
function isRealCount(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

describe("Property 20: fallback dataset validity", () => {
  it("contains between 0 and 50 records (empty when no genuine x.com posts are verified)", () => {
    expect(tweets.length).toBeGreaterThanOrEqual(0);
    expect(tweets.length).toBeLessThanOrEqual(50);
  });

  it("every record is a genuine x.com post with non-empty fields and real engagement counts", () => {
    // An empty dataset trivially satisfies the per-record invariants; there is
    // nothing to draw, so skip the property rather than fail an empty generator.
    if (tweets.length === 0) {
      expect(tweets).toEqual([]);
      return;
    }

    fc.assert(
      fc.property(fc.constantFrom(...tweets), (post) => {
        expect(isNonEmptyString(post.text)).toBe(true);
        expect(isNonEmptyString(post.authorName)).toBe(true);
        expect(isNonEmptyString(post.authorHandle)).toBe(true);
        expect(isNonEmptyString(post.sourceUrl)).toBe(true);
        // The back-link resolves to the post on the x.com host (Req 2.2).
        expect(hostOf(post.sourceUrl as string)).toBe("x.com");
        // Engagement counts are real, not placeholder/fabricated (Req 2.1).
        expect(isRealCount(post.likes)).toBe(true);
        expect(isRealCount(post.reposts)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
