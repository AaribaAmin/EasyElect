// client/src/components/icons/Icon.tsx

import styles from "./Icon.module.css";
import { GLYPHS } from "./glyphs";
import type { IconProps } from "./types";

/**
 * Renders a named inline SVG glyph.
 *
 * The glyph body is looked up from {@link GLYPHS}; an unknown `name` resolves to
 * `GLYPHS.fallback`, so the component always produces a vector and never emits an
 * emoji or a broken image (Req 4.11). Sizing comes from the `size` prop, mapped to
 * the `--icon-size-*` tokens via the `.sm`/`.md`/`.lg` classes (Req 4.9).
 *
 * Accessibility follows the discriminated union in {@link IconProps}:
 * - Decorative icons are hidden from assistive technology with `aria-hidden`
 *   (Req 4.7).
 * - Labeled icons (`decorative={false}`) expose `role="img"` and a non-empty
 *   `aria-label` (Req 4.8).
 */
export default function Icon({
  name,
  size = "md",
  className,
  ...rest
}: IconProps) {
  // Use an own-property check rather than a bare `GLYPHS[name] ?? ...`: bracket
  // access on a plain object would resolve Object.prototype member names (e.g.
  // "valueOf", "toString", "constructor") to inherited functions, bypassing the
  // fallback guard and rendering a non-vector. Guarding on own properties keeps
  // every unknown name resolving to the fallback glyph (Req 4.11).
  const glyph = Object.prototype.hasOwnProperty.call(GLYPHS, name)
    ? GLYPHS[name]
    : GLYPHS.fallback;

  // `rest` is narrowed by the discriminated union: decorative usage carries no
  // `label`; labeled usage (`decorative === false`) guarantees a non-empty one.
  const a11y =
    rest.decorative === false
      ? ({ role: "img", "aria-label": rest.label } as const)
      : ({ "aria-hidden": true } as const);

  return (
    <svg
      viewBox="0 0 24 24"
      className={`${styles.icon} ${styles[size]} ${className ?? ""}`.trim()}
      focusable="false"
      {...a11y}
    >
      {glyph}
    </svg>
  );
}
