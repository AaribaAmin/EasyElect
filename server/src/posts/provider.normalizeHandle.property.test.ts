import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { normalizeHandle } from "./provider.js";

/**
 * Property 1: Handle normalization is idempotent and case/@-insensitive.
 *
 * `normalizeHandle` lowercases its input and strips at most one leading "@".
 * This test asserts the three facets of that contract across arbitrary inputs:
 *
 *   1. Idempotence — normalizing an already-normalized handle is a no-op, so
 *      `normalizeHandle(normalizeHandle(h)) === normalizeHandle(h)` for any `h`.
 *   2. Case-insensitivity — two handles differing only in letter case normalize
 *      to the same value.
 *   3. @-insensitivity — a handle and the same handle with a single extra
 *      leading "@" normalize to the same value.
 *
 * Validates: Requirements 4.3
 */

describe("Property 1: handle normalization is idempotent and case/@-insensitive", () => {
  it("is idempotent for any string", () => {
    fc.assert(
      fc.property(fc.string(), (handle) => {
        const once = normalizeHandle(handle);
        const twice = normalizeHandle(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 200 },
    );
  });

  it("is case-insensitive: handles differing only in case normalize equal", () => {
    fc.assert(
      fc.property(fc.string(), (handle) => {
        const lower = handle.toLowerCase();
        const upper = handle.toUpperCase();
        expect(normalizeHandle(lower)).toBe(normalizeHandle(upper));
      }),
      { numRuns: 200 },
    );
  });

  it("is @-insensitive: a single leading @ does not change the result", () => {
    // `normalizeHandle` strips AT MOST ONE leading "@". So the @-insensitivity
    // property only holds for a base handle that does not itself begin with
    // "@": adding exactly one leading "@" to such a handle normalizes to the
    // same value as the bare handle. (For a base handle like "@", comparing
    // "@@" to "@" would fail — "@@" -> "@" but "@" -> "" — which is correct
    // per the "strip at most one" contract, not a violation of it.) We
    // therefore constrain the base handle to not start with "@".
    fc.assert(
      fc.property(
        fc.string().filter((h) => !h.startsWith("@")),
        (handle) => {
          expect(normalizeHandle("@" + handle)).toBe(normalizeHandle(handle));
        },
      ),
      { numRuns: 200 },
    );
  });
});
