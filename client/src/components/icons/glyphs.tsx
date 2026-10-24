// client/src/components/icons/glyphs.tsx

import type { ReactNode } from "react";
import type { IconName } from "./types";

/**
 * The inline SVG body for every {@link IconName}.
 *
 * Each value is the inner content of an `<svg viewBox="0 0 24 24">` — plain
 * `<path>`/`<g>` elements with no runtime dependency (Req 4.1–4.6). Every glyph
 * draws with `currentColor` for `fill`/`stroke` so it references a color
 * Design_Token through the surrounding CSS `color` (Req 4.10). `fallback` is the
 * placeholder rendered when a name does not resolve (Req 4.11).
 *
 * Stroked glyphs use `strokeWidth={1.75}`, round caps/joins, and no fill; filled
 * glyphs use `fill="currentColor"`. Both reference only `currentColor`, so there
 * are no hardcoded color literals anywhere in this file.
 */
export const GLYPHS: Record<IconName, ReactNode> = {
  // voting — ballot box with a slot and a ballot dropping in
  voting: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5 12 7l8 3.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z" />
      <path d="M9 10.5h6" />
      <path d="M12 3.5v5" />
    </g>
  ),

  // tweets — rounded chat bubble with a tail
  tweets: (
    <path
      fill="currentColor"
      d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.8l-3.9 3.3A1 1 0 0 1 4 18.5V6a2 2 0 0 1 2-2zm2.5 5a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4.5 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4.5 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z"
    />
  ),

  // causes — target / concentric rings with a center dot
  causes: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={8.5} />
      <circle cx={12} cy={12} r={4.5} />
      <circle cx={12} cy={12} r={1} fill="currentColor" stroke="none" />
    </g>
  ),

  // connect — two clasped hands (handshake)
  connect: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5 7 6l4 2.5" />
      <path d="M21 9.5 17 6l-4 2.5" />
      <path d="M11 8.5 8.5 11a1.6 1.6 0 0 0 2.3 2.3l.7-.7" />
      <path d="M11.5 12.6 14 15a1.6 1.6 0 0 0 2.3-2.3l-3.3-3.3a1.6 1.6 0 0 0-2.3 0" />
      <path d="M13 15.3 14.8 17a1.5 1.5 0 0 0 2.2-2" />
      <path d="M3 9.5v5l2 1.5" />
      <path d="M21 9.5v5l-2 1.5" />
    </g>
  ),

  // brand — ballot/check mark inside a rounded square (brand mark)
  brand: (
    <g>
      <rect
        x={3.5}
        y={3.5}
        width={17}
        height={17}
        rx={4.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
      />
      <path
        d="m8 12 2.6 2.6L16 9"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),

  // sun — light theme indicator
  sun: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2.5v2.5" />
      <path d="M12 19v2.5" />
      <path d="M4.2 4.2 6 6" />
      <path d="M18 18l1.8 1.8" />
      <path d="M2.5 12H5" />
      <path d="M19 12h2.5" />
      <path d="M4.2 19.8 6 18" />
      <path d="M18 6l1.8-1.8" />
    </g>
  ),

  // moon — dark theme indicator (crescent)
  moon: (
    <path
      fill="currentColor"
      d="M20 14.2A8 8 0 0 1 9.8 4a1 1 0 0 0-1.3-1.2 9.5 9.5 0 1 0 12.7 12.7 1 1 0 0 0-1.2-1.3z"
    />
  ),

  // chat — chatbot launcher (bubble with a smile)
  chat: (
    <g fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.2 3.4A1 1 0 0 1 4 18.6z" />
      <path d="M8.5 9.5h.01" />
      <path d="M15.5 9.5h.01" />
      <path d="M9 13c.9.8 1.9 1.2 3 1.2s2.1-.4 3-1.2" />
    </g>
  ),

  // like — heart
  like: (
    <path
      fill="currentColor"
      d="M12 20.3 4.6 13a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l.9.9.9-.9a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5z"
    />
  ),

  // repost — two arrows looping (recycle/retweet)
  repost: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 8.5V7a2 2 0 0 1 2-2h8.5" />
      <path d="m13 2.5 3 2.5-3 2.5" />
      <path d="M19 15.5V17a2 2 0 0 1-2 2H8.5" />
      <path d="m11 21.5-3-2.5 3-2.5" />
    </g>
  ),

  // info — "added context" marker: an "i" in a circle
  info: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={8.5} />
      <path d="M12 11v5" />
      <path d="M12 7.75h.01" />
    </g>
  ),

  // fallback — placeholder when a name does not resolve (Req 4.11):
  // a dashed-free rounded square with a centered dot, unmistakably a vector.
  fallback: (
    <g>
      <rect
        x={4}
        y={4}
        width={16}
        height={16}
        rx={4}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
      />
      <circle cx={12} cy={12} r={2} fill="currentColor" />
    </g>
  ),
};
