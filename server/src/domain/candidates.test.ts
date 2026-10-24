import { describe, it, expect } from "vitest";
import { candidates } from "./candidates.js";

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
