import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { detectCauses } from "./scripted.js";

/**
 * Bug condition exploration test for the "healthcare query adds housing card" bug.
 *
 * Property 1: Bug Condition — Affordability Framing Does Not Match Housing.
 *
 * These assertions encode the EXPECTED (fixed) behavior: an affordability-framed
 * message that contains "affordable" but no genuine housing keyword must NOT
 * detect the Housing cause, while still detecting the on-topic cause present.
 *
 * On the UNFIXED code these are EXPECTED TO FAIL, because the Housing cause lists
 * the generic adjective "affordable" as a keyword, so `detectCauses` wrongly
 * surfaces Housing for queries like "I want affordable healthcare".
 *
 * Validates: Requirements 2.1, 2.2, 2.3 (and the defect in 1.1, 1.2, 1.3)
 */

// Non-housing topic keywords mapped to the cause id they should detect.
// None of these keywords contain a genuine housing keyword as a substring,
// so the only reason Housing could appear is the over-broad "affordable" keyword.
const nonHousingTopics: ReadonlyArray<{ keyword: string; causeId: string }> = [
  { keyword: "healthcare", causeId: "healthcare" },
  { keyword: "college", causeId: "education" }, // "college" is the Education keyword
  { keyword: "climate", causeId: "climate" },
  { keyword: "guns", causeId: "guns" },
  { keyword: "transit", causeId: "transit" },
];

describe("Property 1: Bug Condition — affordability framing does not match Housing", () => {
  it("Example 1: 'I want affordable healthcare' detects healthcare, not housing", () => {
    const result = detectCauses("I want affordable healthcare");
    expect(result).not.toContain("housing");
    expect(result).toContain("healthcare");
  });

  it("Example 2: 'affordable college' detects education, not housing", () => {
    const result = detectCauses("affordable college");
    expect(result).not.toContain("housing");
    expect(result).toContain("education");
  });

  it("Example 3: 'is anything affordable anymore' detects no cause", () => {
    const result = detectCauses("is anything affordable anymore");
    expect(result).toEqual([]);
  });

  it("property: 'affordable <non-housing topic>' never detects housing and always detects the topic's cause", () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonHousingTopics), ({ keyword, causeId }) => {
        const result = detectCauses("affordable " + keyword);
        // isBugCondition: text contains "affordable" and no genuine housing keyword.
        expect(result).not.toContain("housing");
        expect(result).toContain(causeId);
      })
    );
  });
});
