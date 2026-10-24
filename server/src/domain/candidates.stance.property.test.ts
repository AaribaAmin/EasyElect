import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { candidates } from "./candidates.js";
import type { Candidate } from "./types.js";

/**
 * Property 18: Stance dataset validity.
 *
 * For any candidate and any stance in its `stances`:
 *  - `issueId` is one of housing, education, guns, healthcare, climate, transit;
 *  - the candidate has at most one stance per `issueId`;
 *  - both `detail.simple` and `detail.expert` are non-empty; and
 *  - every present stance carries a `source` with a non-empty name and a valid
 *    HTTP/HTTPS URL.
 *
 * The generator draws candidates directly from the real dataset, so the
 * property is asserted across every record the API actually serves.
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.6, 3.5
 */

/** The fixed Issue_Set the app supports (Req 2.2). */
const ISSUE_IDS = [
  "housing",
  "education",
  "guns",
  "healthcare",
  "climate",
  "transit",
] as const;

/** True exactly when `value` is an HTTP/HTTPS URL of length 1–2048. */
function isValidHttpUrl(value: string): boolean {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/** True when a string has at least one non-whitespace character. */
function isNonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// The dataset must be non-empty for the property to be meaningful.
const candidateArb: fc.Arbitrary<Candidate> = fc.constantFrom(...candidates);

describe("Property 18: stance dataset validity", () => {
  it("has a non-empty candidate dataset to exercise", () => {
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("every stance has a valid issueId, non-empty detail variants, and a valid source", () => {
    fc.assert(
      fc.property(candidateArb, (candidate) => {
        for (const stance of candidate.stances) {
          // Req 2.2: issueId is a member of the fixed Issue_Set.
          expect(ISSUE_IDS).toContain(stance.issueId);

          // Req 2.4: both detail variants are non-empty.
          expect(isNonEmpty(stance.detail.simple)).toBe(true);
          expect(isNonEmpty(stance.detail.expert)).toBe(true);

          // Req 2.6 / 3.5: every present stance carries a source with a
          // non-empty name and a valid HTTP/HTTPS URL (otherwise the stance
          // would have been omitted rather than inferred).
          expect(stance.source).toBeDefined();
          expect(isNonEmpty(stance.source!.name)).toBe(true);
          expect(isValidHttpUrl(stance.source!.url)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("includes at most one stance per issueId for each candidate", () => {
    fc.assert(
      fc.property(candidateArb, (candidate) => {
        // Req 2.3: no issueId appears more than once in a candidate's stances.
        const issueIds = candidate.stances.map((s) => s.issueId);
        const uniqueIssueIds = new Set(issueIds);
        expect(uniqueIssueIds.size).toBe(issueIds.length);
      }),
      { numRuns: 200 },
    );
  });
});
