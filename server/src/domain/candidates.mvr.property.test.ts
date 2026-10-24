import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { candidates } from "./candidates.js";
import type { Candidate } from "./types.js";

/**
 * Property 8: Minimum_Viable_Records carry no fabricated content.
 *
 * Minimum_Viable_Records are the candidate records drawn verbatim from the
 * Official_Ballot_Source — i.e. those whose `source.url` equals the sample
 * ballot URL below. These records intentionally carry no researched narrative:
 * the ballot gives only identity/office/district/party, so every narrative
 * field must stay empty and no contact details may be invented.
 *
 * For any such record:
 *   - `stances` is an empty array (Req 5.1).
 *   - `bio.simple` and `bio.expert` are both the empty string (Req 5.2).
 *   - `website` is absent/undefined (Req 5.4).
 *   - `handle` is absent/undefined (Req 5.5).
 *
 * The property quantifies over the dataset records themselves (via
 * `fc.constantFrom(...candidates)`) and guards to the Minimum_Viable_Records
 * so the two researched records (Healey/Minogue), which have their own source
 * URLs, are excluded.
 *
 * Validates: Requirements 5.1, 5.2, 5.4, 5.5
 *
 * Feature: all-ballot-candidates-by-office, Property 8
 */

/** The Official_Ballot_Source URL shared by every Minimum_Viable_Record. */
const OFFICIAL_BALLOT_SOURCE_URL =
  "https://www.sec.state.ma.us/WhereDoIVoteMA/ShowBallot/ViewMyBallot/BallotOut/ST/154/0/1?ipid=promo-link-block1";

/** True when a record is a Minimum_Viable_Record (drawn from the ballot). */
function isMinimumViableRecord(candidate: Candidate): boolean {
  return candidate.source.url === OFFICIAL_BALLOT_SOURCE_URL;
}

describe("Feature: all-ballot-candidates-by-office, Property 8", () => {
  it("Minimum_Viable_Records carry no fabricated content", () => {
    fc.assert(
      fc.property(fc.constantFrom<Candidate>(...candidates), (candidate) => {
        // Only Minimum_Viable_Records are constrained here; the researched
        // records (Healey/Minogue) have distinct source URLs and are skipped.
        fc.pre(isMinimumViableRecord(candidate));

        // stances is an empty array (Req 5.1).
        expect(Array.isArray(candidate.stances)).toBe(true);
        expect(candidate.stances.length).toBe(0);

        // bio.simple and bio.expert are both the empty string (Req 5.2).
        expect(candidate.bio.simple).toBe("");
        expect(candidate.bio.expert).toBe("");

        // website is absent/undefined (Req 5.4).
        expect(candidate.website).toBeUndefined();

        // handle is absent/undefined (Req 5.5).
        expect(candidate.handle).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("the dataset contains at least one Minimum_Viable_Record", () => {
    // Guard against the guarded property passing vacuously: confirm the
    // ballot-sourced records actually exist in the dataset.
    const mvrCount = candidates.filter(isMinimumViableRecord).length;
    expect(mvrCount).toBeGreaterThan(0);
  });
});
