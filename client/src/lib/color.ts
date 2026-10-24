/**
 * WCAG color math for the minimalist visual redesign.
 *
 * The redesign's palette is constrained by HSL bounds (pastel saturation and
 * lightness) and by WCAG contrast floors (4.5:1 body text, 3:1 focus outline,
 * and the soft 1.03–1.25:1 band between adjacent surfaces). Those constraints
 * are value-level invariants over the committed design tokens, so they are
 * checked by property tests that read the token hex values through this
 * module.
 *
 * This file provides the pure math those tests (and any future token edit)
 * rely on:
 *   - `hexToHsl` converts a hex color to HSL, with saturation and lightness as
 *     percentages, so Property 1/2 can assert the pastel bounds.
 *   - `relativeLuminance` computes WCAG relative luminance from linearized
 *     sRGB channels.
 *   - `contrastRatio` computes the WCAG contrast ratio `(L1 + 0.05) / (L2 + 0.05)`
 *     where `L1` is the lighter and `L2` the darker relative luminance.
 *
 * All functions are pure (no I/O, no React, no mutation of inputs) so they can
 * be unit- and property-tested in isolation. Definitions follow the W3C WCAG
 * relative-luminance and contrast-ratio specs.
 */

/** An RGB color with each channel in the integer range [0, 255]. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * An HSL color. `h` is in degrees [0, 360); `s` and `l` are percentages in the
 * range [0, 100].
 */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/**
 * Parse a hex color string into its RGB channels.
 *
 * Accepts 3-digit shorthand (`#abc` or `abc`) and 6-digit (`#aabbcc` or
 * `aabbcc`) forms; a leading `#` is optional and case is ignored. In the
 * 3-digit form each nibble is doubled (`#abc` → `#aabbcc`), per the CSS hex
 * color rule.
 *
 * Throws a `TypeError` for any input that is not a valid 3- or 6-digit hex
 * color, so a malformed token surfaces immediately rather than silently
 * producing a wrong color.
 */
export function hexToRgb(hex: string): Rgb {
  if (typeof hex !== "string") {
    throw new TypeError("hexToRgb: expected a string");
  }

  const normalized = hex.trim().replace(/^#/, "").toLowerCase();

  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(normalized)) {
    throw new TypeError(`hexToRgb: invalid hex color "${hex}"`);
  }

  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Convert a hex color to HSL.
 *
 * Returns `{ h, s, l }` where `h` is in degrees [0, 360) and `s`/`l` are
 * percentages in [0, 100]. Accepts the same 3- and 6-digit hex forms as
 * `hexToRgb`. For an achromatic color (all channels equal) hue and saturation
 * are 0.
 */
export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);

  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }

    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: s * 100,
    l: l * 100,
  };
}

/**
 * Linearize a single sRGB channel.
 *
 * Takes a channel value in [0, 255] and returns its linear-light value in
 * [0, 1] using the WCAG sRGB transfer function: channels at or below the
 * 0.03928 threshold scale linearly, and above it follow the gamma curve.
 */
function linearizeChannel(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Compute the WCAG relative luminance of a hex color.
 *
 * Linearizes each sRGB channel and combines them with the WCAG coefficients
 * (0.2126 R, 0.7152 G, 0.0722 B), yielding a luminance in [0, 1] where 0 is
 * black and 1 is white.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * linearizeChannel(r) +
    0.7152 * linearizeChannel(g) +
    0.0722 * linearizeChannel(b)
  );
}

/**
 * Compute the WCAG contrast ratio between two hex colors.
 *
 * Returns `(L1 + 0.05) / (L2 + 0.05)` where `L1` is the lighter and `L2` the
 * darker relative luminance, so the result is in [1, 21] and is symmetric in
 * its arguments: `contrastRatio(a, b) === contrastRatio(b, a)`, and
 * `contrastRatio(a, a) === 1`.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
