import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isDisplayableSourceUrl } from "./url";

/**
 * Property 22: Source-URL display guard is correct.
 *
 * `isDisplayableSourceUrl` returns true exactly when the input string is a
 * syntactically valid HTTP or HTTPS URL whose length is 1–2048 (inclusive),
 * and false otherwise (non-HTTP(S) schemes, malformed strings, empty, or
 * over-length).
 *
 * **Validates: Requirements 3.3, 3.4**
 */

const MAX_URL_LENGTH = 2048;

/**
 * Reference oracle, derived straight from the acceptance criteria. It mirrors
 * the specification (valid HTTP/HTTPS URL of length 1–2048) using an
 * independent parse so the test does not just restate the implementation.
 */
function expectedDisplayable(url: string): boolean {
  if (typeof url !== "string") return false;
  if (url.length < 1 || url.length > MAX_URL_LENGTH) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

describe("isDisplayableSourceUrl — Property 22 (source-URL display guard)", () => {
  it("accepts valid http/https URLs of length 1–2048", () => {
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        // fast-check webUrl yields http/https URLs well under 2048 chars.
        expect(isDisplayableSourceUrl(url)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("rejects non-http(s) scheme URLs", () => {
    const scheme = fc.constantFrom(
      "ftp",
      "mailto",
      "javascript",
      "file",
      "data",
      "ws",
      "tel"
    );
    fc.assert(
      fc.property(scheme, fc.webUrl(), (s, httpUrl) => {
        // Rebuild the authority/path portion of a real URL under a bad scheme.
        const rest = httpUrl.replace(/^https?:\/\//, "");
        const candidate = `${s}://${rest}`;
        expect(isDisplayableSourceUrl(candidate)).toBe(expectedDisplayable(candidate));
        expect(isDisplayableSourceUrl(candidate)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("rejects the empty string", () => {
    expect(isDisplayableSourceUrl("")).toBe(false);
  });

  it("rejects over-length (>2048) URLs even when otherwise valid", () => {
    fc.assert(
      fc.property(fc.integer({ min: MAX_URL_LENGTH + 1, max: 4096 }), (len) => {
        const base = "https://example.com/";
        const padded = base + "a".repeat(len - base.length);
        expect(padded.length).toBe(len);
        expect(isDisplayableSourceUrl(padded)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("accepts boundary-length URLs at exactly 2048 and rejects at 2049", () => {
    const base = "https://example.com/";
    const at2048 = base + "a".repeat(MAX_URL_LENGTH - base.length);
    const at2049 = base + "a".repeat(MAX_URL_LENGTH + 1 - base.length);
    expect(at2048.length).toBe(MAX_URL_LENGTH);
    expect(at2049.length).toBe(MAX_URL_LENGTH + 1);
    expect(isDisplayableSourceUrl(at2048)).toBe(true);
    expect(isDisplayableSourceUrl(at2049)).toBe(false);
  });

  it("agrees with the specification oracle for arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2100 }), (s) => {
        expect(isDisplayableSourceUrl(s)).toBe(expectedDisplayable(s));
      }),
      { numRuns: 300 }
    );
  });

  it("agrees with the specification oracle across a mix of URL-like and junk inputs", () => {
    const generator = fc.oneof(
      fc.webUrl(),
      fc.string({ maxLength: 50 }),
      fc.constantFrom(
        "ftp://example.com",
        "mailto:someone@example.com",
        "javascript:alert(1)",
        "example.com",
        "//example.com",
        "http://",
        "https://",
        " http://example.com",
        "HTTP://EXAMPLE.COM"
      )
    );
    fc.assert(
      fc.property(generator, (s) => {
        expect(isDisplayableSourceUrl(s)).toBe(expectedDisplayable(s));
      }),
      { numRuns: 300 }
    );
  });
});
