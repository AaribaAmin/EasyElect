import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { candidates } from "./candidates.js";
import type { SourceAttribution } from "./types.js";

/**
 * Property 19: Source attribution dates are valid ISO calendar dates.
 *
 * Every SourceAttribution in the candidate dataset — each candidate's own
 * `source` plus every stance's optional `source` — must carry a `reviewedOn`
 * that is both (a) in the strict YYYY-MM-DD shape and (b) a real calendar date
 * (so "2026-13-40" or "2026-02-30" are rejected, not just malformed strings).
 *
 * Validates: Requirements 10.1
 */

/** Collect every SourceAttribution present in the dataset. */
function collectSources(): SourceAttribution[] {
  const sources: SourceAttribution[] = [];
  for (const candidate of candidates) {
    sources.push(candidate.source);
    for (const stance of candidate.stances) {
      if (stance.source) {
        sources.push(stance.source);
      }
    }
  }
  return sources;
}

/**
 * True when `value` is exactly YYYY-MM-DD AND denotes a real calendar date.
 * Parsing in UTC and round-tripping the components rejects overflow dates such
 * as 2026-13-40 or 2026-02-30 that the regex alone would let through.
 */
function isValidIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

describe("Property 19: Source attribution dates are valid ISO calendar dates", () => {
  const sources = collectSources();

  it("the dataset exposes at least one SourceAttribution to check", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it("every dataset SourceAttribution has a reviewedOn that is a real ISO calendar date", () => {
    fc.assert(
      fc.property(fc.constantFrom(...sources), (source) => {
        expect(isValidIsoCalendarDate(source.reviewedOn)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Guard: confirm the validator actually rejects overflow dates, so a passing
  // dataset result above is meaningful rather than a permissive check.
  it("the calendar-date validator rejects shape-valid but impossible dates", () => {
    expect(isValidIsoCalendarDate("2026-13-40")).toBe(false);
    expect(isValidIsoCalendarDate("2026-02-30")).toBe(false);
    expect(isValidIsoCalendarDate("2026-00-10")).toBe(false);
    expect(isValidIsoCalendarDate("2026-1-1")).toBe(false);
    expect(isValidIsoCalendarDate("2026/01/01")).toBe(false);
  });
});
