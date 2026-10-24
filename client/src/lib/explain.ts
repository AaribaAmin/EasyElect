/**
 * Detail-mode variant selection for dual-variant `Explain` copy.
 *
 * Requirement 8.1: present the variant matching the selected Detail_Mode.
 * Requirement 8.2: when the matching variant is missing (empty), report that
 * the detail is unavailable rather than silently substituting the other
 * variant, while leaving the rest of the record intact.
 *
 * `selectVariant` is a pure function so it can be unit- and property-tested in
 * isolation (see the detail-mode variant selection property test).
 */
import type { Explain } from "../types/domain";
import type { DetailMode } from "../context/SettingsContext";

/** User-facing indication shown when the selected mode's variant is missing. */
export const DETAIL_UNAVAILABLE = "Detail unavailable" as const;

/**
 * Result of selecting a variant: either the exact non-empty variant for the
 * requested mode, or a signal that the variant is unavailable. Returning a
 * discriminated result (rather than a substituted string) lets callers render
 * a distinct "detail unavailable" indication while preserving the rest of the
 * record.
 */
export type VariantSelection =
  | { available: true; text: string }
  | { available: false };

/**
 * Return the exact non-empty variant of `content` for `mode` when present;
 * otherwise signal that the detail is unavailable. A variant is considered
 * missing when it is absent or empty/whitespace-only. The input record is
 * never mutated.
 */
export function selectVariant(
  content: Explain,
  mode: DetailMode
): VariantSelection {
  const value = mode === "expert" ? content.expert : content.simple;
  if (typeof value === "string" && value.trim().length > 0) {
    return { available: true, text: value };
  }
  return { available: false };
}
