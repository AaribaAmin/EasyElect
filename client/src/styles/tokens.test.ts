import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import {
  PALETTE,
  CARD_TOKENS,
  TYPE_SCALE,
  THEME_NAMES,
  CARD_TOKEN_NAMES,
  ALL_TOKENS,
  type ThemeName,
} from "./tokens";

/**
 * Value-level property + parity tests for the redesign's design tokens.
 *
 * jsdom does not resolve the CSS `var()` cascade or perform layout, so these
 * tests read the exported structures in `tokens.ts` directly rather than
 * computed styles. The parity test closes the loop by asserting those same
 * values are mirrored verbatim into `global.css`, so the property tests are
 * testing the values the stylesheet actually ships.
 *
 * Properties covered here: 4 (solid color / no gradient), 7 (resolve-or-default
 * fallback), 8 (per-card distinctness), 15 (type-scale monotonicity). Contrast
 * and HSL-bound properties (1, 2, 3, 5, 6, 14) live in `../lib/color.test.ts`.
 */

// ---------------------------------------------------------------------------
// Property 4: Primary and accent are single solid colors
// ---------------------------------------------------------------------------

/** The two constrained color tokens Property 4 ranges over, per theme. */
const SOLID_COLOR_TOKENS = ["--color-primary", "--color-accent"] as const;

/** Matches a gradient function in any CSS value (what Property 4 forbids). */
const GRADIENT_RE =
  /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i;

/**
 * Matches a single solid color literal: 3- or 6-digit hex, `rgb()/rgba()`, or
 * `hsl()/hsla()`. A value is a "single solid color" when it matches one of
 * these forms end-to-end and carries no gradient function.
 */
const SOLID_COLOR_RE =
  /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6})|rgba?\([^()]*\)|hsla?\([^()]*\))$/i;

/** True when `value` is a single solid color with no gradient function. */
function isSolidColor(value: string): boolean {
  return SOLID_COLOR_RE.test(value.trim()) && !GRADIENT_RE.test(value);
}

describe("tokens — Property 4 (primary/accent are single solid colors)", () => {
  // Feature: minimalist-visual-redesign, Property 4: Primary and accent are single solid colors — for all theme and each token in {--color-primary, --color-accent}, the value parses as a single solid color (hex/rgb/hsl) and contains no gradient function.
  it("every --color-primary/--color-accent is a solid color with no gradient", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...THEME_NAMES),
        fc.constantFrom(...SOLID_COLOR_TOKENS),
        (theme, tokenName) => {
          const value = PALETTE[theme][tokenName];
          expect(isSolidColor(value)).toBe(true);
          expect(GRADIENT_RE.test(value)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: minimalist-visual-redesign, Property 4: Primary and accent are single solid colors — the solid-color recognizer rejects any gradient-bearing value, so the no-gradient guarantee is meaningful.
  it("rejects gradient-bearing values for the same tokens (recognizer soundness)", () => {
    const gradientKind = fc.constantFrom(
      "linear-gradient",
      "radial-gradient",
      "conic-gradient",
      "repeating-linear-gradient"
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...THEME_NAMES),
        fc.constantFrom(...SOLID_COLOR_TOKENS),
        gradientKind,
        (theme, tokenName, kind) => {
          const solid = PALETTE[theme][tokenName];
          const gradient = `${kind}(90deg, ${solid}, #ffffff)`;
          expect(isSolidColor(gradient)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Missing tokens resolve to a defined non-empty default
// ---------------------------------------------------------------------------

/**
 * The spacing/radius defaults the `var(name, fallback)` convention supplies
 * when those tokens are undefined. Spacing fallbacks must be non-zero; the
 * design pins them to the shared light-theme defaults (see global.css `:root`).
 */
const SPACING_FALLBACKS: Record<string, string> = {
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "24px",
  "--space-6": "32px",
  "--space-7": "48px",
  "--radius-sm": "6px",
  "--radius-md": "12px",
  "--radius-lg": "18px",
};

/** A spacing-length token whose fallback must additionally be non-zero. */
function isSpacingToken(name: string): boolean {
  return name.startsWith("--space-") || name.startsWith("--radius-");
}

/**
 * Model the `var(name, fallback)` resolve-or-default convention: when a token
 * is undefined, resolution returns the provided fallback. Here the fallback
 * for a token is its defined light-theme value (colors/card/icon from
 * ALL_TOKENS.light) or its pinned spacing/radius default.
 */
function resolveWithFallback(name: string): string | undefined {
  if (name in SPACING_FALLBACKS) return SPACING_FALLBACKS[name];
  return ALL_TOKENS.light[name];
}

/** Strip the unit from a length and parse the numeric magnitude. */
function lengthMagnitude(value: string): number {
  const m = value.trim().match(/^(-?\d*\.?\d+)/);
  return m ? Number(m[1]) : NaN;
}

/** The full token-name set Property 7 ranges over. */
const FALLBACK_TOKEN_NAMES: readonly string[] = [
  ...Object.keys(ALL_TOKENS.light),
  ...Object.keys(SPACING_FALLBACKS),
];

describe("tokens — Property 7 (missing tokens resolve to a non-empty default)", () => {
  // Feature: minimalist-visual-redesign, Property 7: Missing tokens resolve to a defined non-empty default — for all token names, resolving var(name, fallback) when the token is undefined returns a non-empty fallback (non-zero for spacing); none resolve empty/unset.
  it("every token name resolves to a non-empty (non-zero for spacing) fallback", () => {
    fc.assert(
      fc.property(fc.constantFrom(...FALLBACK_TOKEN_NAMES), (name) => {
        const resolved = resolveWithFallback(name);
        // A defined fallback exists and is a non-empty string.
        expect(typeof resolved).toBe("string");
        expect(resolved).toBeTruthy();
        expect((resolved as string).trim().length).toBeGreaterThan(0);
        // Spacing/radius fallbacks must be non-zero lengths.
        if (isSpacingToken(name)) {
          expect(lengthMagnitude(resolved as string)).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: The four per-card pastel tokens are mutually distinct
// ---------------------------------------------------------------------------

describe("tokens — Property 8 (the four per-card pastels are mutually distinct)", () => {
  // Feature: minimalist-visual-redesign, Property 8: The four per-card pastel tokens are mutually distinct — for all theme, the four --card-* tokens resolve to four pairwise-different color values.
  it("the four --card-* tokens are pairwise different per theme", () => {
    fc.assert(
      fc.property(fc.constantFrom(...THEME_NAMES), (theme) => {
        const values = CARD_TOKEN_NAMES.map((n) =>
          CARD_TOKENS[theme][n].trim().toLowerCase()
        );
        const unique = new Set(values);
        expect(unique.size).toBe(CARD_TOKEN_NAMES.length);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: minimalist-visual-redesign, Property 8: The four per-card pastel tokens are mutually distinct — stated as pairwise inequality over every unordered pair of the four tokens, per theme.
  it("no two distinct --card-* tokens share a value (pairwise form)", () => {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < CARD_TOKEN_NAMES.length; i++) {
      for (let j = i + 1; j < CARD_TOKEN_NAMES.length; j++) {
        pairs.push([i, j]);
      }
    }
    fc.assert(
      fc.property(
        fc.constantFrom(...THEME_NAMES),
        fc.constantFrom(...pairs),
        (theme, [i, j]) => {
          const a = CARD_TOKENS[theme][CARD_TOKEN_NAMES[i]].toLowerCase();
          const b = CARD_TOKENS[theme][CARD_TOKEN_NAMES[j]].toLowerCase();
          expect(a).not.toBe(b);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: Type scale is monotonically non-increasing and single-valued
// ---------------------------------------------------------------------------

/** Parse a `rem`/`px` size to its numeric magnitude for comparison. */
function sizeMagnitude(size: string): number {
  const m = size.trim().match(/^(-?\d*\.?\d+)/);
  expect(m, `size "${size}" has no numeric magnitude`).not.toBeNull();
  return Number((m as RegExpMatchArray)[1]);
}

describe("tokens — Property 15 (type scale monotonic & single-valued)", () => {
  // Feature: minimalist-visual-redesign, Property 15: The type scale is monotonically non-increasing and single-valued per level — for all adjacent level pairs (i, i+1), font-size(i) >= font-size(i+1), and each level maps to exactly one size value.
  it("font-size(level_i) >= font-size(level_{i+1}) for every adjacent pair", () => {
    const adjacentIndices = fc.integer({
      min: 0,
      max: TYPE_SCALE.length - 2,
    });
    fc.assert(
      fc.property(adjacentIndices, (i) => {
        const current = sizeMagnitude(TYPE_SCALE[i].size);
        const next = sizeMagnitude(TYPE_SCALE[i + 1].size);
        expect(current).toBeGreaterThanOrEqual(next);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: minimalist-visual-redesign, Property 15: The type scale is monotonically non-increasing and single-valued per level — each level name appears exactly once with exactly one size value.
  it("each level maps to exactly one size value", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TYPE_SCALE.map((l) => l.level)),
        (level) => {
          const entries = TYPE_SCALE.filter((l) => l.level === level);
          expect(entries).toHaveLength(1);
          const sizes = new Set(entries.map((e) => e.size));
          expect(sizes.size).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Parity test: every token in tokens.ts appears with the same value in global.css
// ---------------------------------------------------------------------------

/**
 * Read global.css as text. It sits next to this test file; resolve against the
 * test file's own directory so the test is independent of the cwd vitest runs
 * from.
 */
function readGlobalCss(): string {
  const dir = path.dirname(new URL(import.meta.url).pathname);
  return readFileSync(path.join(dir, "global.css"), "utf8");
}

/**
 * Extract the declaration body of a CSS block whose selector is `selector`
 * (e.g. `:root`, `[data-theme="dark"]`). Returns the text between the opening
 * `{` and its matching `}`. Returns `null` when the selector is not found.
 */
function extractBlock(css: string, selector: string): string | null {
  const selIdx = css.indexOf(selector);
  if (selIdx === -1) return null;
  const openIdx = css.indexOf("{", selIdx);
  if (openIdx === -1) return null;
  const closeIdx = css.indexOf("}", openIdx);
  if (closeIdx === -1) return null;
  return css.slice(openIdx + 1, closeIdx);
}

/** Parse `--name: value;` declarations in a block into a name→value map. */
function parseDeclarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** Normalize a CSS value for comparison (collapse whitespace, lowercase). */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The global.css selector that carries each theme's token values. */
const THEME_SELECTOR: Record<ThemeName, string> = {
  light: ":root",
  dark: '[data-theme="dark"]',
};

describe("tokens ↔ global.css parity", () => {
  const css = readGlobalCss();

  // `:root` is the base layer: `[data-theme="dark"]` overrides only the tokens
  // that change, and inherits the rest (e.g. the theme-independent
  // --icon-size-* tokens). So the effective value of a dark-theme token is its
  // dark override when present, otherwise the `:root` value. Model that by
  // folding the dark declarations over the `:root` declarations.
  const rootBlock = extractBlock(css, THEME_SELECTOR.light);
  const rootDecls = rootBlock ? parseDeclarations(rootBlock) : {};

  it(`global.css has a ${THEME_SELECTOR.light} block`, () => {
    expect(rootBlock).not.toBeNull();
  });

  for (const theme of THEME_NAMES) {
    describe(`${theme} theme (${THEME_SELECTOR[theme]})`, () => {
      const block = extractBlock(css, THEME_SELECTOR[theme]);

      it(`has a ${THEME_SELECTOR[theme]} block`, () => {
        expect(block).not.toBeNull();
      });

      const themeDecls = block ? parseDeclarations(block) : {};
      // Effective declarations after cascade: dark inherits `:root`, light is
      // `:root` itself.
      const effective =
        theme === "light" ? rootDecls : { ...rootDecls, ...themeDecls };
      const expected = ALL_TOKENS[theme];

      for (const [name, value] of Object.entries(expected)) {
        it(`${name} matches tokens.ts (${value})`, () => {
          expect(
            effective[name],
            `${name} not resolvable for ${THEME_SELECTOR[theme]} (absent from both the theme block and :root)`
          ).toBeDefined();
          expect(normalize(effective[name])).toBe(normalize(value));
        });
      }
    });
  }
});
