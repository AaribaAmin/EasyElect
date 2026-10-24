import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import { cacheLifetimeSeconds } from "./cache.js";

/**
 * Property test for cache lifetime configuration clamping.
 *
 * Property 15: Cache lifetime is always a valid clamped value.
 *
 * `cacheLifetimeSeconds()` reads the `EASYELECT_POSTS_CACHE_TTL_SECONDS`
 * environment variable and must always return an integer that is either a
 * valid in-range configured value or exactly the documented default. For any
 * arbitrary string (or unset) env value:
 *   - the result is always an integer;
 *   - when the input parses to an integer in [1, 86400], that value is returned;
 *   - otherwise (unset, non-numeric, non-integer, or out of range) the result
 *     is exactly the default, 300.
 *
 * Validates: Requirements 6.6
 */

const ENV_KEY = "EASYELECT_POSTS_CACHE_TTL_SECONDS";
const DEFAULT = 300;
const MIN = 1;
const MAX = 86400;

describe("Property 15: cache lifetime is always a valid clamped value", () => {
  // Save the original value once so each case can be restored independently.
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it("returns the default (300) when the variable is unset", () => {
    delete process.env[ENV_KEY];
    expect(cacheLifetimeSeconds()).toBe(DEFAULT);
  });

  it("returns the configured value at the clamp bounds [1, 86400]", () => {
    process.env[ENV_KEY] = String(MIN);
    expect(cacheLifetimeSeconds()).toBe(MIN);
    process.env[ENV_KEY] = String(MAX);
    expect(cacheLifetimeSeconds()).toBe(MAX);
  });

  it("returns the default for out-of-range, non-integer, and non-numeric values", () => {
    for (const raw of ["0", "86401", "-5", "3.5", "abc", "", "  ", "NaN", "1e5"]) {
      process.env[ENV_KEY] = raw;
      expect(cacheLifetimeSeconds()).toBe(DEFAULT);
    }
  });

  it("property: result is an integer, equal to an in-range integer input or exactly 300", () => {
    fc.assert(
      fc.property(
        // A mix of free-form strings and deliberately interesting numeric-looking
        // strings so the generator explores both the valid and invalid input space.
        fc.oneof(
          fc.string(),
          fc.integer({ min: -1000, max: 90000 }).map(String),
          fc.float({ noNaN: false }).map(String),
          fc.constantFrom("", "  ", "NaN", "Infinity", "-Infinity", "1e3", "0x10", "300.0"),
        ),
        (raw) => {
          process.env[ENV_KEY] = raw;
          const result = cacheLifetimeSeconds();

          // Always an integer.
          expect(Number.isInteger(result)).toBe(true);

          // Determine whether `raw` is a valid in-range integer per the spec.
          const parsed = Number(raw);
          const trimmedEmpty = raw.trim() === "";
          const isValidInRange =
            !trimmedEmpty &&
            Number.isInteger(parsed) &&
            parsed >= MIN &&
            parsed <= MAX;

          if (isValidInRange) {
            expect(result).toBe(parsed);
          } else {
            expect(result).toBe(DEFAULT);
          }

          // Regardless of branch, the result is always a valid clamped value.
          expect(result === DEFAULT || (result >= MIN && result <= MAX)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
