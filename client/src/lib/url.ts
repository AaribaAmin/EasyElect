/**
 * Source-URL display guard.
 *
 * Candidate records carry a source attribution URL that the UI turns into a
 * user-activatable link. Before rendering that link we must confirm the URL is
 * safe and well-formed: an HTTP or HTTPS URL of a sane length. When this guard
 * returns false, the presentation shows a "source unavailable" indication in
 * place of the link while keeping the rest of the record (Req 3.4).
 */

/** Maximum allowed URL length (inclusive). */
const MAX_URL_LENGTH = 2048;

/**
 * isDisplayableSourceUrl — pure predicate.
 *
 * Returns true exactly when `url` is a syntactically valid HTTP or HTTPS URL
 * whose string length is between 1 and 2048 characters (inclusive). Returns
 * false for absent, empty, over-length, malformed, or non-HTTP(S) inputs.
 */
export function isDisplayableSourceUrl(url: string): boolean {
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
