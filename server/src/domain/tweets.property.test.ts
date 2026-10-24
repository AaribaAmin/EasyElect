import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { tweets } from "./tweets.js";
import { candidatesById } from "./candidates.js";

/**
 * Property 1: Bug Condition -> fixed (non-empty, verified fallback) + Verified_Source.
 *
 * The curated News_Dataset (`tweets`) served on the fallback branch of
 * resolveTweets is non-empty and holds ONLY Verified_Source records. For any
 * execution the dataset holds between 0 and 100 records; the dataset is
 * non-empty and at least one item carries `"recent"` in its `tabs` (so the
 * Recent News tab is populated on the fallback branch — this encodes the fixed
 * bug condition). For every record present:
 *   - `id`, `title`, `outlet`, `url`, and `date` are all non-empty strings,
 *   - `url` parses via `new URL(...)` with an `http:`/`https:` protocol
 *     (Verified_Source — replaces the prior x.com-host guarantee),
 *   - `date` is a valid ISO 8601 date string (parses, not NaN, YYYY-MM-DD or
 *     full ISO),
 *   - `candidateIds` is a non-empty array with no duplicates, and every id is a
 *     key in `candidatesById` (resolves to a real candidate in candidates.ts),
 *   - any `context` block carries non-empty `simple` and `expert` strings.
 *
 * Property 3 consistency: any item whose `tabs` include `"interactions"` has
 * `candidateIds.length >= 2`, so tab membership and the multi-candidate rule
 * agree.
 *
 * The dataset is a fixed, curated array, so the generator ranges over the
 * dataset's own records via `fc.constantFrom(...tweets)` — every run draws a
 * real record and asserts the per-record invariants hold for it. When the
 * dataset is empty there are no records to draw, so the per-record property is
 * skipped and only the size bound is asserted.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.5
 */

/** True exactly when `value` is a non-empty, non-whitespace string. */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** True when `url` parses and its protocol is `http:` or `https:`. */
function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * True when `date` is a valid ISO 8601 date string: it parses to a real date
 * (not NaN) and matches either a `YYYY-MM-DD` date or a full ISO date-time.
 */
function isIsoDate(date: string): boolean {
  if (!isNonEmptyString(date)) return false;
  const isoShape =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!isoShape.test(date)) return false;
  return !Number.isNaN(Date.parse(date));
}

/** True when the array has no duplicate entries. */
function hasNoDuplicates(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

describe("Property 1: fallback dataset validity (verified, non-empty)", () => {
  it("contains between 0 and 100 records", () => {
    expect(tweets.length).toBeGreaterThanOrEqual(0);
    expect(tweets.length).toBeLessThanOrEqual(100);
  });

  it("is non-empty and populates the Recent News tab (fixed bug condition)", () => {
    // Encodes Property 1: on the fallback branch the curated dataset is
    // non-empty and at least one item appears on the Recent News tab.
    expect(tweets.length).toBeGreaterThanOrEqual(1);
    expect(tweets.some((item) => item.tabs.includes("recent"))).toBe(true);
  });

  it("every record is a Verified_Source tied to real candidates", () => {
    // An empty dataset trivially satisfies the per-record invariants; there is
    // nothing to draw, so skip the property rather than fail an empty generator.
    if (tweets.length === 0) {
      expect(tweets).toEqual([]);
      return;
    }

    fc.assert(
      fc.property(fc.constantFrom(...tweets), (item) => {
        // Non-empty identifying/display strings.
        expect(isNonEmptyString(item.id)).toBe(true);
        expect(isNonEmptyString(item.title)).toBe(true);
        expect(isNonEmptyString(item.outlet)).toBe(true);
        expect(isNonEmptyString(item.url)).toBe(true);
        expect(isNonEmptyString(item.date)).toBe(true);

        // Verified_Source: url resolves over HTTP/HTTPS.
        expect(isHttpUrl(item.url)).toBe(true);

        // date is a valid ISO 8601 string.
        expect(isIsoDate(item.date)).toBe(true);

        // candidateIds: non-empty, no duplicates, every id a real candidate.
        expect(Array.isArray(item.candidateIds)).toBe(true);
        expect(item.candidateIds.length).toBeGreaterThanOrEqual(1);
        expect(hasNoDuplicates(item.candidateIds)).toBe(true);
        for (const id of item.candidateIds) {
          expect(candidatesById.has(id)).toBe(true);
        }

        // Optional context: when present, both detail levels are non-empty.
        if (item.context !== undefined) {
          expect(isNonEmptyString(item.context.simple)).toBe(true);
          expect(isNonEmptyString(item.context.expert)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("Property 3: interactions items have at least two candidates", () => {
    if (tweets.length === 0) {
      expect(tweets).toEqual([]);
      return;
    }

    fc.assert(
      fc.property(fc.constantFrom(...tweets), (item) => {
        if (item.tabs.includes("interactions")) {
          expect(item.candidateIds.length).toBeGreaterThanOrEqual(2);
        }
      }),
      { numRuns: 200 },
    );
  });
});
