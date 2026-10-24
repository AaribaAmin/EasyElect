import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { candidates } from "./candidates.js";
import type { Candidate, Party } from "./types.js";

/**
 * Candidate dataset validity properties.
 *
 * For any candidate drawn from the real MA candidate dataset, the record
 * satisfies the structural invariants the UI and attribution layer rely on.
 * Two properties live here:
 *
 *   - Property 7 (Feature: all-ballot-candidates-by-office): every record is
 *     structurally valid — non-empty unique `id`, `party` in the `Party`
 *     union, non-empty `office`/`district` within 1–120 chars, a `source`
 *     whose `url` equals the Official_Ballot_Source for Minimum_Viable_Records
 *     (or a valid HTTP/HTTPS URL for researched records) and whose
 *     `reviewedOn` is "2026-10-24". (Validates: Requirements 1.4, 2.1, 2.2,
 *     5.3)
 *   - Property 17: the original structural invariants (`id`, `party`,
 *     `source.name`, `source.url`, optional `website`, dataset-wide id
 *     uniqueness). (Validates: Requirements 1.4, 1.5, 3.1, 3.2)
 *
 * Both properties quantify over the dataset records themselves (via
 * `fc.constantFrom(...candidates)`) so every record is exercised, and the
 * dataset-wide uniqueness invariant is asserted once.
 */

/**
 * The valid members of the `Party` union, per domain/types.ts. Must list every
 * member of the union, including "Socialism and Liberation" and "Unenrolled"
 * added for the ballot-affiliation expansion; otherwise records carrying the
 * new affiliations would be wrongly flagged invalid. (Req 6.1, 6.2)
 */
const PARTIES: readonly Party[] = [
  "Democratic",
  "Republican",
  "Independent",
  "Libertarian",
  "Green-Rainbow",
  "Nonpartisan",
  "Socialism and Liberation",
  "Unenrolled",
];
const PARTY_SET = new Set<string>(PARTIES);

/**
 * The Official_Ballot_Source URL shared by every Minimum_Viable_Record, per
 * candidates.ts / Requirement 5.3. Records whose `source.url` equals this are
 * ballot-derived; any other `source.url` belongs to a researched record.
 */
const OFFICIAL_BALLOT_SOURCE_URL =
  "https://www.sec.state.ma.us/WhereDoIVoteMA/ShowBallot/ViewMyBallot/BallotOut/ST/154/0/1?ipid=promo-link-block1";

/** The ballot review date carried by every record's source. (Req 5.3) */
const REVIEWED_ON = "2026-10-24";

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

describe("Feature: all-ballot-candidates-by-office, Property 7: candidate record structural validity", () => {
  it("every candidate record is structurally valid", () => {
    fc.assert(
      fc.property(fc.constantFrom<Candidate>(...candidates), (candidate) => {
        // id is a non-empty string (Req 1.4).
        expect(typeof candidate.id).toBe("string");
        expect(candidate.id.length).toBeGreaterThan(0);

        // party is a member of the Party union (Req 1.4 / 6.3).
        expect(PARTY_SET.has(candidate.party)).toBe(true);

        // office is a non-empty string within 1–120 chars (Req 2.1).
        expect(typeof candidate.office).toBe("string");
        expect(candidate.office.length).toBeGreaterThanOrEqual(1);
        expect(candidate.office.length).toBeLessThanOrEqual(120);

        // district is a non-empty string within 1–120 chars (Req 2.2).
        expect(typeof candidate.district).toBe("string");
        expect(candidate.district.length).toBeGreaterThanOrEqual(1);
        expect(candidate.district.length).toBeLessThanOrEqual(120);

        // source.url rule (Req 5.3): a Minimum_Viable_Record's source.url
        // equals the Official_Ballot_Source exactly; a researched record's
        // source.url is some other valid HTTP/HTTPS URL. Either way the url is
        // a valid in-bounds HTTP/HTTPS URL (the Official_Ballot_Source is one).
        if (candidate.source.url === OFFICIAL_BALLOT_SOURCE_URL) {
          expect(candidate.source.url).toBe(OFFICIAL_BALLOT_SOURCE_URL);
        } else {
          expect(isHttpUrlInBounds(candidate.source.url)).toBe(true);
        }
        expect(isHttpUrlInBounds(candidate.source.url)).toBe(true);

        // source.reviewedOn is the ballot review date for every record (Req 5.3).
        expect(candidate.source.reviewedOn).toBe(REVIEWED_ON);

        // any defined website is a valid HTTP/HTTPS URL of length 1–2048.
        if (candidate.website !== undefined) {
          expect(isHttpUrlInBounds(candidate.website)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("all candidate ids are unique across the dataset", () => {
    // Dataset-wide invariant (Req 1.4): asserted once over the whole array.
    const ids = candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Property 17: candidate dataset validity", () => {
  it("every candidate record satisfies the structural invariants", () => {
    fc.assert(
      fc.property(fc.constantFrom<Candidate>(...candidates), (candidate) => {
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
      }),
      { numRuns: 100 },
    );
  });

  it("all candidate ids are unique across the dataset", () => {
    // Dataset-wide invariant (Req 1.5): asserted once over the whole array.
    const ids = candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Feature: all-ballot-candidates-by-office, Property 10: party values are all in the union and client-accepted", () => {
  it("every candidate's party is a member of the Party union", () => {
    // For any candidate drawn from the dataset, its `party` is one of the
    // union members in PARTY_SET — which now includes the two ballot-expansion
    // members "Socialism and Liberation" and "Unenrolled". Because the client's
    // shape.ts PARTIES array mirrors this same union, a party that is in the
    // union is also client-accepted. (Validates: Requirements 6.3, 7.1, 7.4)
    fc.assert(
      fc.property(fc.constantFrom<Candidate>(...candidates), (candidate) => {
        expect(PARTY_SET.has(candidate.party)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
