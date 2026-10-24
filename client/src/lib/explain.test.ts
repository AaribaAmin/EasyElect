import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { selectVariant } from "./explain";
import type { Explain } from "../types/domain";
import type { DetailMode } from "../context/SettingsContext";

/**
 * Property 21: Detail-mode variant selection.
 *
 * For any `Explain` value and any detail mode ("simple" | "expert"):
 *  - when the mode's variant is present (non-empty, non-whitespace), the
 *    selector returns `{ available: true, text }` with that exact variant;
 *  - when the mode's variant is missing (empty or whitespace-only), the
 *    selector returns `{ available: false }` and does not mutate the input.
 *
 * **Validates: Requirements 8.1, 8.2**
 */

/** Modes the selector accepts. */
const modeArb: fc.Arbitrary<DetailMode> = fc.constantFrom("simple", "expert");

/**
 * Strings that are "present": contain at least one non-whitespace character
 * after trimming. Padding with surrounding whitespace keeps the content
 * non-empty while exercising the trim boundary.
 */
const presentArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.string({ minLength: 0, maxLength: 4 }).filter((s) => /^\s*$/.test(s)),
    fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
    fc.string({ minLength: 0, maxLength: 4 }).filter((s) => /^\s*$/.test(s))
  )
  .map(([pre, core, post]) => `${pre}${core}${post}`);

/** Strings that are "missing": empty or whitespace-only. */
const missingArb: fc.Arbitrary<string> = fc.constantFrom(
  "",
  " ",
  "   ",
  "\t",
  "\n",
  " \t\n ",
  "\r\n"
);

/** Either a present or a missing variant for one slot. */
const variantArb: fc.Arbitrary<string> = fc.oneof(presentArb, missingArb);

/** Arbitrary `Explain` with independently present-or-missing variants. */
const explainArb: fc.Arbitrary<Explain> = fc.record({
  simple: variantArb,
  expert: variantArb,
});

/** Independent oracle: the variant string the mode points at. */
function variantFor(content: Explain, mode: DetailMode): string {
  return mode === "expert" ? content.expert : content.simple;
}

/** Independent oracle: whether that variant counts as present. */
function isPresent(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

describe("selectVariant — Property 21 (detail-mode variant selection)", () => {
  it("returns the exact non-empty variant when the mode's variant is present", () => {
    fc.assert(
      fc.property(explainArb, modeArb, (content, mode) => {
        const value = variantFor(content, mode);
        fc.pre(isPresent(value));
        const result = selectVariant(content, mode);
        expect(result.available).toBe(true);
        if (result.available) {
          expect(result.text).toBe(value);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("reports unavailable when the mode's variant is missing", () => {
    fc.assert(
      fc.property(explainArb, modeArb, (content, mode) => {
        const value = variantFor(content, mode);
        fc.pre(!isPresent(value));
        const result = selectVariant(content, mode);
        expect(result.available).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("agrees with the specification oracle for any Explain and mode", () => {
    fc.assert(
      fc.property(explainArb, modeArb, (content, mode) => {
        const value = variantFor(content, mode);
        const result = selectVariant(content, mode);
        if (isPresent(value)) {
          expect(result).toEqual({ available: true, text: value });
        } else {
          expect(result).toEqual({ available: false });
        }
      }),
      { numRuns: 300 }
    );
  });

  it("never mutates the input record (missing or present)", () => {
    fc.assert(
      fc.property(explainArb, modeArb, (content, mode) => {
        const snapshot = { simple: content.simple, expert: content.expert };
        selectVariant(content, mode);
        // Field values and key set are unchanged by selection.
        expect(content).toEqual(snapshot);
        expect(Object.keys(content).sort()).toEqual(["expert", "simple"]);
      }),
      { numRuns: 200 }
    );
  });

  it("selects independently per mode on the same record", () => {
    // A record with one present and one missing variant resolves differently
    // depending on the requested mode, confirming the mode actually drives
    // selection rather than any fixed fallback.
    fc.assert(
      fc.property(presentArb, missingArb, (present, missing) => {
        const simplePresent: Explain = { simple: present, expert: missing };
        expect(selectVariant(simplePresent, "simple")).toEqual({
          available: true,
          text: present,
        });
        expect(selectVariant(simplePresent, "expert")).toEqual({
          available: false,
        });
      }),
      { numRuns: 200 }
    );
  });
});
