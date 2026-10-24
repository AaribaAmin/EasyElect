import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { candidates } from "./candidates.js";
import type { Candidate, Party } from "./types.js";

/**
 * Property 17: Candidate dataset validity.
 *
 * For any candidate drawn from the real MA candidate dataset, the record
 * satisfies the structural invariants the UI and attribution layer rely on:
 *   - `id` is a non-empty string (Req 1.5).
 *   - `party` is a member of the `Party` union (Req 1.4).
 *   - `source.name` is a non-empty string (Req 3.1).
 *   - `source.url` is an HTTP/HTTPS URL of length 1–2048 (Req 3.2).
 *   - any defined `website` is likewise an HTTP/HTTPS URL of length 1–2048
 *     (Req 3.2).
 * Across the whole dataset, all ids are unique (Req 1.5).
 *
 * The property quantifies over the dataset records themselves (via
 * `fc.constantFrom(...candidates)`) so every record is exercised, and the
 * dataset-wide uniqueness invariant is asserted once.
 *
 * Validates: Requirements 1.4, 1.5, 3.1, 3.2
 */

/** The valid members of the `Party` union, per domain/types.ts. */
const PARTIES: readonly Party[] = [
  "Democratic",
  "Republican",
  "Independent",
  "Libertarian",
  "Green-Rainbow",
  "Nonpartisan",
];
const PARTY_SET = new Set<string>(PARTIES);

/**
 * True when `value` is an HTTP/HTTPS URL of length 1–2048. Uses the WHATWG URL
 * parser (available in Node) rather than a regex so parsing matches runtime
 * behavior, then restricts the scheme and bounds the length.
 */
function isHttpUrlInBounds(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

describe("Property 17: candidate dataset validity", () => {
  it("every candidate record satisfies the structural invariants", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Candidate>(...candidates),
        (candidate) => {
          // id is a non-empty string (Req 1.5).
          expect(typeof candidate.id).toBe("string");
          expect(candidate.id.length).toBeGreaterThan(0);

          // party is a member of the Party union (Req 1.4).
          expect(PARTY_SET.has(candidate.party)).toBe(true);

          // source.name is a non-empty string (Req 3.1).
          expect(typeof candidate.source.name).toBe("string");
          expect(candidate.source.name.length).toBeGreaterThan(0);

          // source.url is an HTTP/HTTPS URL of length 1–2048 (Req 3.2).
          expect(isHttpUrlInBounds(candidate.source.url)).toBe(true);

          // any defined website is an HTTP/HTTPS URL of length 1–2048 (Req 3.2).
          if (candidate.website !== undefined) {
            expect(isHttpUrlInBounds(candidate.website)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("all candidate ids are unique across the dataset", () => {
    // Dataset-wide invariant (Req 1.5): asserted once over the whole array.
    const ids = candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
