import { describe, it, expect } from "vitest";
import { candidates } from "./candidates.js";
import {
  checkDatasetCompleteness,
  OFFICIAL_BALLOT_ROSTER,
} from "./candidates.validation.js";

describe("candidate dataset size and uniqueness floor", () => {
  it("contains at least 2 candidate records", () => {
    // Requirement 1.2: the dataset must have at least 2 records.
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("assigns every candidate a non-empty id", () => {
    // Requirement 1.5: each id is non-empty.
    for (const candidate of candidates) {
      expect(typeof candidate.id).toBe("string");
      expect(candidate.id.length).toBeGreaterThan(0);
    }
  });

  it("assigns unique ids across the dataset", () => {
    // Requirement 1.5: ids are unique (no duplicates).
    const ids = candidates.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// Feature: all-ballot-candidates-by-office, Property 6
describe("Feature: all-ballot-candidates-by-office, Property 6: every ballot candidate is present in the dataset", () => {
  it("reports the dataset complete with empty missing/extra against the official roster", () => {
    // Validates: Requirements 1.1, 1.6
    const result = checkDatasetCompleteness(candidates);
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it("has exactly one candidate record for each OFFICIAL_BALLOT_ROSTER entry", () => {
    // Validates: Requirements 1.1, 1.6
    for (const entry of OFFICIAL_BALLOT_ROSTER) {
      const matches = candidates.filter((c) => c.name === entry.name);
      expect(matches.length).toBe(1);
    }
  });
});
