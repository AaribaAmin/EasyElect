import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { hexToHsl, relativeLuminance, contrastRatio } from "./color";
import {
  PALETTE,
  CARD_TOKENS,
  THEME_NAMES,
  PALETTE_TOKEN_NAMES,
  CARD_TOKEN_NAMES,
  ADJACENT_SURFACE_PAIRS,
  type ThemeName,
} from "../styles/tokens";

/**
 * Value-level property tests for the WCAG color utility and the committed
 * design tokens.
 *
 * jsdom resolves no CSS `var()` cascade and performs no layout, so these tests
 * read the token hex values directly from `../styles/tokens.ts` (the single
 * source of truth kept in lockstep with `global.css` by the parity test) and
 * run the pure helpers in `./color.ts` over them. Each property iterates the
 * full token/pair set rather than a single example, so a future palette edit
 * that quietly breaks a bound surfaces here.
 *
 * fast-check drives the iteration with `{ numRuns: 100 }`; where a property is
 * bounded to a small fixed set (themes, named token pairs) the generator
 * chooses from that enumerated set so every member is exercised across runs.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 2.5, 2.6, 5.5, 9.5**
 */

const NUM_RUNS = 100;

/** Pick the pair of HSL-constrained color tokens for a theme. */
const CONSTRAINED_COLOR_TOKENS = ["--color-primary", "--color-accent"] as const;

/** The readable body/muted text tokens. */
const TEXT_TOKENS = ["--color-text", "--color-text-muted"] as const;

/** All surface tokens a focus outline (drawn in `--color-primary`) can sit on. */
const FOCUS_SURFACE_TOKENS = [
  "--color-bg",
  "--color-surface",
  "--color-surface-alt",
] as const;

/** An arbitrary over the two theme names. */
const themeArb: fc.Arbitrary<ThemeName> = fc.constantFrom(...THEME_NAMES);

describe("color utility — value-level property tests", () => {
  // Feature: minimalist-visual-redesign, Property 1: Pastel HSL bounds hold for constrained color tokens — for all theme and each of --color-primary/--color-accent, HSL S<=60% and (light) L in 55-85%, (dark) S<=60%.
  it("Property 1: pastel HSL bounds hold for --color-primary and --color-accent", () => {
    fc.assert(
      fc.property(
        themeArb,
        fc.constantFrom(...CONSTRAINED_COLOR_TOKENS),
        (theme, token) => {
          const { s, l } = hexToHsl(PALETTE[theme][token]);
          expect(s).toBeLessThanOrEqual(60);
          if (theme === "light") {
            expect(l).toBeGreaterThanOrEqual(55);
            expect(l).toBeLessThanOrEqual(85);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: minimalist-visual-redesign, Property 2: Dark base surfaces stay dark — for all of dark --color-bg/--color-surface, HSL L<=20%.
  it("Property 2: dark --color-bg and --color-surface have HSL lightness <= 20%", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("--color-bg", "--color-surface"),
        (token) => {
          const { l } = hexToHsl(PALETTE.dark[token as "--color-bg"]);
          expect(l).toBeLessThanOrEqual(20);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: minimalist-visual-redesign, Property 3: Adjacent surfaces are softly distinct — for all theme and each adjacent surface pair, contrast in [1.03, 1.25].
  it("Property 3: adjacent surface pairs contrast within [1.03, 1.25]", () => {
    fc.assert(
      fc.property(
        themeArb,
        fc.constantFrom(...ADJACENT_SURFACE_PAIRS),
        (theme, [a, b]) => {
          const ratio = contrastRatio(PALETTE[theme][a], PALETTE[theme][b]);
          expect(ratio).toBeGreaterThanOrEqual(1.03);
          expect(ratio).toBeLessThanOrEqual(1.25);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: minimalist-visual-redesign, Property 5: Body and surface text meet the 4.5:1 readability floor — text/muted vs bg/surface/card-* >= 4.5:1.
  it("Property 5: text and muted text meet 4.5:1 against bg, surface, and every card", () => {
    const baseSurfaces = ["--color-bg", "--color-surface"] as const;
    fc.assert(
      fc.property(
        themeArb,
        fc.constantFrom(...TEXT_TOKENS),
        fc.constantFrom(...baseSurfaces, ...CARD_TOKEN_NAMES),
        (theme, textToken, surfaceToken) => {
          const textHex = PALETTE[theme][textToken];
          const surfaceHex =
            surfaceToken === "--color-bg" || surfaceToken === "--color-surface"
              ? PALETTE[theme][surfaceToken]
              : CARD_TOKENS[theme][surfaceToken];
          // --color-text is asserted against bg/surface/cards; --color-text-muted
          // against cards is the design's per-card body floor (2.5/2.6). Both
          // text tokens clear 4.5:1 against every surface in this set.
          expect(contrastRatio(textHex, surfaceHex)).toBeGreaterThanOrEqual(4.5);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: minimalist-visual-redesign, Property 6: Text on primary meets the 4.5:1 floor — --color-primary-contrast vs --color-primary >= 4.5:1 per theme.
  it("Property 6: --color-primary-contrast meets 4.5:1 against --color-primary", () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        const ratio = contrastRatio(
          PALETTE[theme]["--color-primary-contrast"],
          PALETTE[theme]["--color-primary"]
        );
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: minimalist-visual-redesign, Property 14: Focus outline contrast floor holds on every surface — --color-primary vs each surface/card token >= 3:1.
  it("Property 14: --color-primary meets 3:1 against every surface and card token", () => {
    fc.assert(
      fc.property(
        themeArb,
        fc.constantFrom(...FOCUS_SURFACE_TOKENS, ...CARD_TOKEN_NAMES),
        (theme, surfaceToken) => {
          const primaryHex = PALETTE[theme]["--color-primary"];
          const surfaceHex =
            surfaceToken === "--color-bg" ||
            surfaceToken === "--color-surface" ||
            surfaceToken === "--color-surface-alt"
              ? PALETTE[theme][surfaceToken]
              : CARD_TOKENS[theme][surfaceToken];
          expect(contrastRatio(primaryHex, surfaceHex)).toBeGreaterThanOrEqual(3);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: minimalist-visual-redesign, Property (sanity): contrastRatio is symmetric — contrastRatio(a, b) === contrastRatio(b, a).
  it("sanity: contrastRatio is symmetric in its arguments", () => {
    // Draw real token hex values from every theme/token so the property runs
    // over the colors the app actually ships, not arbitrary strings.
    const tokenHexArb = fc
      .constantFrom(...THEME_NAMES)
      .chain((theme) =>
        fc.oneof(
          fc
            .constantFrom(...PALETTE_TOKEN_NAMES)
            .map((name) => PALETTE[theme][name]),
          fc.constantFrom(...CARD_TOKEN_NAMES).map((name) => CARD_TOKENS[theme][name])
        )
      );
    fc.assert(
      fc.property(tokenHexArb, tokenHexArb, (a, b) => {
        expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: minimalist-visual-redesign, Property (sanity): a color has unit contrast with itself — contrastRatio(a, a) === 1.
  it("sanity: contrastRatio(a, a) === 1 for every token color", () => {
    const tokenHexArb = fc
      .constantFrom(...THEME_NAMES)
      .chain((theme) =>
        fc.oneof(
          fc
            .constantFrom(...PALETTE_TOKEN_NAMES)
            .map((name) => PALETTE[theme][name]),
          fc.constantFrom(...CARD_TOKEN_NAMES).map((name) => CARD_TOKENS[theme][name])
        )
      );
    fc.assert(
      fc.property(tokenHexArb, (a) => {
        expect(contrastRatio(a, a)).toBe(1);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // A tiny luminance sanity check: pure white and black bound the scale, so
  // their contrast is the WCAG maximum of 21:1. This anchors relativeLuminance.
  it("sanity: relativeLuminance orders black < white and their contrast is 21:1", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
  });
});
