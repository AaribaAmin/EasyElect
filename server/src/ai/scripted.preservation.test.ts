import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { detectCauses } from "./scripted.js";
import { causes } from "../domain/causes.js";

/**
 * Preservation tests for the "healthcare query adds housing card" bug.
 *
 * Property 2: Preservation — Non-Bug Cause Detection Unchanged.
 *
 * These assertions capture the BASELINE behavior that the upcoming fix must
 * leave untouched: for every input that does NOT satisfy the bug condition
 * (genuine housing keywords, other-cause queries without "affordable", mixed
 * housing-plus-topic queries, and no-match strings) `detectCauses` produces the
 * same result after the fix as it does now.
 *
 * Observation-first methodology: each example below was run against the UNFIXED
 * code first and the asserted outputs are the actually observed outputs, so the
 * whole file PASSES on the unfixed code (confirming the baseline to preserve).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

const genuineHousingKeywords = [
  "housing",
  "rent",
  "homes",
  "eviction",
  "landlord",
  "tenant",
] as const;

describe("Property 2: Preservation — non-bug cause detection unchanged", () => {
  // 3.1 — each genuine housing keyword still detects Housing.
  for (const kw of genuineHousingKeywords) {
    it(`genuine housing keyword "${kw}" still detects housing (3.1)`, () => {
      expect(detectCauses(kw)).toContain("housing");
    });
  }

  // 3.2 — other causes without "affordable" detect exactly that one cause.
  it("'I care about healthcare' detects exactly [healthcare] (3.2)", () => {
    expect(detectCauses("I care about healthcare")).toEqual(["healthcare"]);
  });

  it("'tell me about climate' detects exactly [climate] (3.2)", () => {
    expect(detectCauses("tell me about climate")).toEqual(["climate"]);
  });

  // 3.3 — mixed query detects both housing (via genuine keyword "rent") and healthcare.
  it("'affordable rent and healthcare' detects both housing and healthcare (3.3)", () => {
    const result = detectCauses("affordable rent and healthcare");
    expect(result).toContain("housing");
    expect(result).toContain("healthcare");
  });

  // 3.4 — a message matching no keywords detects no causes.
  it("'the quick brown fox' detects no causes (3.4)", () => {
    expect(detectCauses("the quick brown fox")).toEqual([]);
  });

  /**
   * Property-based preservation check.
   *
   * We generate messages drawn exclusively from the NON-BUG input space and
   * assert `detectCauses` equals a reference computed against the current
   * (original) keyword lists imported from the source. Because every generated
   * message is a non-bug-condition input, this reference stays valid after the
   * fix — the fix only changes outputs for bug-condition inputs (messages with
   * "affordable" and no genuine housing keyword), which are excluded here.
   */
  it("property: non-bug inputs match a reference over the original keyword lists", () => {
    // Reference mirrors detectCauses against whatever keyword lists are in
    // the source right now (unfixed: Housing still includes "affordable").
    const referenceDetect = (message: string): string[] => {
      const text = message.toLowerCase();
      const hits: string[] = [];
      for (const cause of causes) {
        if (cause.keywords.some((k) => text.includes(k.toLowerCase()))) {
          hits.push(cause.id);
        }
      }
      return hits;
    };

    // Non-bug input space: genuine housing terms, other-cause terms, and
    // no-match filler words. None of these rely on the over-broad "affordable"
    // keyword to produce a Housing match, so they are all non-bug-condition.
    const genuineHousing = fc.constantFrom(...genuineHousingKeywords);
    const otherCauseTerms = fc.constantFrom(
      "healthcare",
      "health",
      "insurance",
      "education",
      "school",
      "college",
      "climate",
      "solar",
      "guns",
      "firearm",
      "transit",
      "bus",
      "train",
    );
    const noMatchTerms = fc.constantFrom(
      "the",
      "quick",
      "brown",
      "fox",
      "lorem",
      "ipsum",
      "zzz",
      "hello world",
    );

    const token = fc.oneof(genuineHousing, otherCauseTerms, noMatchTerms);

    fc.assert(
      fc.property(fc.array(token, { minLength: 1, maxLength: 5 }), (tokens) => {
        const message = tokens.join(" ");
        // Guard: skip any message that happens to be a bug-condition input
        // (contains "affordable" but no genuine housing keyword). The chosen
        // token pools never include "affordable", so this is belt-and-suspenders.
        const lower = message.toLowerCase();
        const hasAffordable = lower.includes("affordable");
        const hasGenuineHousing = genuineHousingKeywords.some((k) =>
          lower.includes(k),
        );
        if (hasAffordable && !hasGenuineHousing) return; // not a non-bug input
        expect(detectCauses(message)).toEqual(referenceDetect(message));
      }),
    );
  });
});
