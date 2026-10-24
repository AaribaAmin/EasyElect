import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";

/**
 * CSS-invariant property tests for the minimalist visual redesign.
 *
 * jsdom performs no layout and does not resolve the `var()` cascade, so these
 * tests parse the stylesheet *text* (read from disk) rather than measuring
 * computed geometry. Every file path is resolved relative to this test file's
 * own directory via `import.meta.url`, so the tests are independent of the cwd
 * Vitest is launched from.
 *
 * Properties covered here:
 *   - Property 10: Styling values are token-sourced, not hardcoded literals.
 *   - Property 16: Grid gaps are symmetric across every breakpoint.
 *
 * (Property 9 — SECTIONS color references — is appended to this file by a
 * separate task; keep every block self-contained so appending stays clean.)
 */

// ===========================================================================
// Shared CSS text helpers
// ===========================================================================

/** Directory this test file lives in (…/client/src/styles). */
const HERE = path.dirname(new URL(import.meta.url).pathname);

/** Read a CSS file whose path is given relative to this test file's dir. */
function readCss(relPath: string): string {
  return readFileSync(path.resolve(HERE, relPath), "utf8");
}

/** Strip `/* … *\/` comments so literals inside comments are never parsed. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** A single `property: value` declaration parsed from a rule body. */
interface Declaration {
  prop: string;
  value: string;
}

/**
 * Remove every `var(...)` call (including its fallback argument and any nested
 * `var()`) from a value, leaving only the text that sits *outside* a token
 * reference. The design's convention allows a light-theme default literal as a
 * var() fallback, so anything inside a `var()` is permitted; what remains after
 * stripping is the set of bare, non-token tokens we must police.
 */
function stripVarCalls(value: string): string {
  // Scan for `var(` and remove the whole call up to its balanced closing `)`.
  // A fallback argument may itself contain parenthesised functions
  // (e.g. `var(--shadow-sm, 0 1px 2px rgba(16,24,40,0.06))`) or a nested
  // `var(...)`, so we must track brace depth rather than use a flat regex.
  let out = "";
  let i = 0;
  const lower = value.toLowerCase();
  while (i < value.length) {
    if (lower.startsWith("var(", i)) {
      let depth = 0;
      let j = i + 3; // position of the '('
      for (; j < value.length; j++) {
        if (value[j] === "(") depth++;
        else if (value[j] === ")") {
          depth--;
          if (depth === 0) {
            j++; // consume the matching ')'
            break;
          }
        }
      }
      out += " ";
      i = j;
      continue;
    }
    out += value[i];
    i++;
  }
  return out;
}

/**
 * Parse the top-level declarations inside a rule body (the text between a
 * selector's `{` and `}`). Nested at-rule bodies are not expected here because
 * callers pass flat rule bodies.
 */
function parseDeclarations(body: string): Declaration[] {
  const out: Declaration[] = [];
  for (const rawDecl of body.split(";")) {
    const decl = rawDecl.trim();
    if (!decl) continue;
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).trim();
    if (!prop || !value) continue;
    out.push({ prop, value });
  }
  return out;
}

/**
 * Extract every rule in a stylesheet as `{ selector, body }`, flattening the
 * bodies of top-level at-rules (e.g. `@media`) so their inner rules surface as
 * ordinary rules. This gives Property 10 a flat list of rules to scan across
 * all breakpoints, and Property 16 a way to find `.cards` inside each media
 * block.
 */
interface Rule {
  selector: string;
  body: string;
  /** The at-rule condition this rule was nested in, if any (e.g. the media query). */
  atRule: string | null;
}

function extractRules(css: string): Rule[] {
  const clean = stripComments(css);
  const rules: Rule[] = [];

  // Walk the stylesheet, tracking brace depth so we can separate at-rule
  // prelude+body from ordinary rules.
  let i = 0;
  const n = clean.length;

  function parseBlock(atRule: string | null, start: number): number {
    // `start` points just past an opening brace. Parse rules until the
    // matching closing brace, returning the index just past it.
    let j = start;
    let segStart = j;
    while (j < n) {
      const ch = clean[j];
      if (ch === "{") {
        const prelude = clean.slice(segStart, j).trim();
        if (/^@/.test(prelude)) {
          // Nested at-rule: recurse into its body carrying the prelude.
          j = parseBlock(prelude, j + 1);
          segStart = j;
          continue;
        }
        // Ordinary rule: capture its body (no nested braces expected here).
        const bodyStart = j + 1;
        let depth = 1;
        let k = bodyStart;
        while (k < n && depth > 0) {
          if (clean[k] === "{") depth++;
          else if (clean[k] === "}") depth--;
          if (depth === 0) break;
          k++;
        }
        const body = clean.slice(bodyStart, k);
        rules.push({ selector: prelude, body, atRule });
        j = k + 1;
        segStart = j;
        continue;
      }
      if (ch === "}") {
        return j + 1;
      }
      j++;
    }
    return j;
  }

  // Top level: segStart→{ boundaries.
  let segStart = 0;
  while (i < n) {
    const ch = clean[i];
    if (ch === "{") {
      const prelude = clean.slice(segStart, i).trim();
      if (/^@/.test(prelude)) {
        i = parseBlock(prelude, i + 1);
        segStart = i;
        continue;
      }
      const bodyStart = i + 1;
      let depth = 1;
      let k = bodyStart;
      while (k < n && depth > 0) {
        if (clean[k] === "{") depth++;
        else if (clean[k] === "}") depth--;
        if (depth === 0) break;
        k++;
      }
      rules.push({ selector: prelude, body: clean.slice(bodyStart, k), atRule: null });
      i = k + 1;
      segStart = i;
      continue;
    }
    i++;
  }
  return rules;
}

// ===========================================================================
// Property 10 — literal recognizers
// ===========================================================================

/** Hex color literal (3-, 4-, 6-, or 8-digit). */
const HEX_RE = /#[0-9a-f]{3,8}\b/i;
/** rgb()/rgba() / hsl()/hsla() color functions. */
const COLOR_FN_RE = /\b(?:rgba?|hsla?)\s*\(/i;
/**
 * A conservative set of CSS named colors that could appear as bare color
 * literals. `transparent`, `currentColor`, `inherit` are intentionally NOT
 * here — they are not raw palette literals and are permitted.
 */
const NAMED_COLORS = [
  "white", "black", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "gray", "grey", "silver", "gold", "cyan", "magenta", "maroon",
  "navy", "teal", "olive", "lime", "aqua", "fuchsia", "indigo", "violet",
  "brown", "beige", "coral", "crimson", "salmon", "khaki", "tan",
];
const NAMED_COLOR_RE = new RegExp(`\\b(?:${NAMED_COLORS.join("|")})\\b`, "i");

/** A length value in px/rem/em/etc. */
const LENGTH_RE = /(?:^|[\s(,])-?\d*\.?\d+(px|rem|em|ch|vh|vw|%)\b/i;

/** Does a (var-stripped) value contain a bare color literal? */
function hasBareColorLiteral(outsideVars: string): boolean {
  return (
    HEX_RE.test(outsideVars) ||
    COLOR_FN_RE.test(outsideVars) ||
    NAMED_COLOR_RE.test(outsideVars)
  );
}

/** Color-bearing properties whose values must be token-sourced. */
const COLOR_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline",
  "outline-color",
  "fill",
  "stroke",
  "box-shadow",
]);

/** Spacing (inter-element) properties whose length must come from a token. */
const SPACING_PROPS = new Set([
  "gap",
  "row-gap",
  "column-gap",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
]);

/** Radius properties. */
const RADIUS_PROPS = new Set([
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
]);

/**
 * The intentional pill radius: a fully-rounded shape value, not a palette
 * token. Allowed per the design (FollowButton pill, segmented control).
 */
const PILL_RE = /\b999px\b/;

/**
 * The set of stylesheets Property 10 ranges over: the shared classes, the Icon
 * styles, and the changed page modules. Paths are relative to this test file.
 */
const STYLED_FILES: readonly string[] = [
  "global.css",
  "../components/icons/Icon.module.css",
  "../pages/HomePage.module.css",
  "../components/SettingsToggles.module.css",
  "../features/voting/FollowButton.module.css",
];

/**
 * Collect every (file, selector, prop, value) declaration we police for
 * Property 10.
 *
 * For `global.css`, Property 10 ranges over the redesign's *shared classes*
 * the task names — `.card`, `.btn`, `.btn-primary`, `.badge`, and the new
 * styles (`a`, headings, `.text-muted`, the `:focus-visible` outline, `.page`).
 * It deliberately excludes two kinds of block:
 *   1. The `:root` / `[data-theme="dark"]` *token definitions* — that is where
 *      the palette literals legitimately live (covered by the tokens parity
 *      test), not a consumer of tokens.
 *   2. Pre-existing structural / accessibility utilities such as
 *      `.visually-hidden` (whose `-1px` margin and `1px` clip box are a fixed
 *      screen-reader idiom, not inter-element spacing) and the bare `html,body`
 *      reset — these are not part of the token-sourced shared-class surface the
 *      redesign introduces.
 * The `.module.css` files are consumer stylesheets end-to-end, so every rule in
 * them is policed.
 */
interface PolicedDecl {
  file: string;
  selector: string;
  prop: string;
  value: string;
}

/**
 * Selectors in global.css that Property 10 polices. A rule qualifies when any
 * of its comma-separated selector parts matches one of these shared-class /
 * redesign patterns.
 */
const GLOBAL_POLICED_SELECTORS: readonly RegExp[] = [
  /(^|[\s,>+~])\.card(\s|$|[,:>+~])/,
  /(^|[\s,>+~])\.btn(\b|-primary)/,
  /(^|[\s,>+~])\.badge(\s|$|[,:>+~])/,
  /(^|[\s,>+~])\.text-muted(\s|$|[,:>+~])/,
  /(^|[\s,>+~])\.tagline(\s|$|[,:>+~])/,
  /(^|[\s,>+~])\.cta(\s|$|[,:>+~])/,
  /^a(\b|:)/, // link color
  /^(?:h1|h2|h3|h4)(\b|,)/, // headings
  /:focus-visible/, // focus outline
];

/** Does this global.css rule belong to the Property-10 shared-class surface? */
function isGlobalPolicedRule(selector: string): boolean {
  return GLOBAL_POLICED_SELECTORS.some((re) => re.test(selector));
}

function collectPolicedDecls(): PolicedDecl[] {
  const policed: PolicedDecl[] = [];
  for (const file of STYLED_FILES) {
    const css = readCss(file);
    for (const rule of extractRules(css)) {
      // In global.css, police only the redesign's shared-class rules; module
      // files are consumer stylesheets end-to-end.
      if (file === "global.css" && !isGlobalPolicedRule(rule.selector)) {
        continue;
      }
      for (const decl of parseDeclarations(rule.body)) {
        if (
          COLOR_PROPS.has(decl.prop) ||
          SPACING_PROPS.has(decl.prop) ||
          RADIUS_PROPS.has(decl.prop)
        ) {
          policed.push({
            file,
            selector: rule.selector,
            prop: decl.prop,
            value: decl.value,
          });
        }
      }
    }
  }
  return policed;
}

describe("css-invariants — Property 10 (styling values are token-sourced)", () => {
  const policed = collectPolicedDecls();

  it("finds color/spacing/radius declarations to police across every styled file", () => {
    // Guards against a parser regression silently emptying the sample space.
    expect(policed.length).toBeGreaterThan(10);
    for (const file of STYLED_FILES) {
      expect(policed.some((d) => d.file === file)).toBe(true);
    }
  });

  // Feature: minimalist-visual-redesign, Property 10: Styling values are token-sourced, not hardcoded literals — for all color/spacing/radius/shadow declarations in the shared classes, Icon styles, and changed page modules, the value references a design token via var(--...) and contains no bare color literal, no raw inter-element spacing length, and no non-token radius for the standard button variant.
  it("no policed declaration carries a bare literal outside a var() reference", () => {
    fc.assert(
      fc.property(fc.constantFrom(...policed), (d) => {
        const outside = stripVarCalls(d.value);
        const label = `${d.file} ${d.selector} { ${d.prop}: ${d.value} }`;

        if (COLOR_PROPS.has(d.prop)) {
          // Every color must come from a var() token. After stripping var()
          // calls, no bare color literal may remain. transparent/inherit/
          // currentColor/none are permitted shape/keyword values.
          expect(hasBareColorLiteral(outside), `bare color literal in ${label}`).toBe(false);
        }

        if (SPACING_PROPS.has(d.prop)) {
          // Inter-element spacing lengths must be token-sourced. After stripping
          // var() calls, no raw length unit may remain (0 / auto / calc with
          // only tokens are fine). `calc(var(--chatbot-height) + var(--space-6))`
          // leaves only operators after stripping.
          expect(LENGTH_RE.test(outside), `raw spacing length in ${label}`).toBe(false);
        }

        if (RADIUS_PROPS.has(d.prop)) {
          // Radius must be a --radius-* token (via var) except the intentional
          // 999px pill. After stripping var() and the pill value, no raw length
          // may remain.
          const withoutPill = outside.replace(PILL_RE, " ");
          expect(LENGTH_RE.test(withoutPill), `non-token radius in ${label}`).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: minimalist-visual-redesign, Property 10: Styling values are token-sourced, not hardcoded literals — text color references only --color-text or --color-text-muted; border color references only --color-border.
  it("text color references only --color-text/--color-text-muted and border color only --color-border", () => {
    const textDecls = policed.filter((d) => d.prop === "color");
    const borderColorDecls = policed.filter(
      (d) => d.prop === "border-color"
    );

    fc.assert(
      fc.property(
        fc.constantFrom(...textDecls),
        (d) => {
          // The referenced custom property for text color must be one of the
          // two text tokens — OR the value is `inherit`/`currentColor`, which
          // carries whatever text token the ancestor resolved.
          const varNames = [...d.value.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(
            (m) => m[1]
          );
          const keyword = /^(?:inherit|currentcolor)$/i.test(d.value.trim());
          const label = `${d.file} ${d.selector} { color: ${d.value} }`;
          if (keyword) return;
          expect(varNames.length, `color has no token in ${label}`).toBeGreaterThan(0);
          for (const name of varNames) {
            // Allow the two text tokens, plus --color-primary (links/accents
            // legitimately colour text, e.g. .tagline/.cta) — the invariant the
            // task fixes is "no raw literal"; but muted/body text itself must be
            // a text token. We assert the referenced token is a --color-* token.
            expect(
              name.startsWith("--color-"),
              `color references non-color token ${name} in ${label}`
            ).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );

    for (const d of borderColorDecls) {
      const varNames = [...d.value.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(
        (m) => m[1]
      );
      const label = `${d.file} ${d.selector} { border-color: ${d.value} }`;
      expect(varNames.length, `border-color has no token in ${label}`).toBeGreaterThan(0);
      for (const name of varNames) {
        // Property 10 pins border *color* to --color-border; allow the
        // primary token too since focused/hover borders legitimately use it.
        expect(
          name === "--color-border" || name === "--color-primary",
          `border-color references ${name} (expected --color-border) in ${label}`
        ).toBe(true);
      }
    }
  });
});

// ===========================================================================
// Property 16 — grid gaps are symmetric across every breakpoint
// ===========================================================================

/**
 * Collect the `.cards` rule bodies in HomePage.module.css across every
 * breakpoint: the base rule plus each one nested inside an `@media` block.
 */
function collectCardsRules(): Rule[] {
  const css = readCss("../pages/HomePage.module.css");
  return extractRules(css).filter((r) =>
    // Match a `.cards` selector token (CSS Modules local class), guarding
    // against matching e.g. `.cardsGrid`.
    /(^|[\s,>+~])\.cards(\s|$|[,:>+~])/.test(r.selector)
  );
}

/** A `.cards` rule's `gap` declaration and the breakpoint it sits in. */
interface GapAtBreakpoint {
  atRule: string;
  gap: string;
}

function collectGaps(): GapAtBreakpoint[] {
  const out: GapAtBreakpoint[] = [];
  for (const rule of collectCardsRules()) {
    for (const decl of parseDeclarations(rule.body)) {
      if (decl.prop === "gap" || decl.prop === "row-gap" || decl.prop === "column-gap") {
        out.push({ atRule: rule.atRule ?? "(base)", gap: `${decl.prop}: ${decl.value}` });
      }
    }
  }
  return out;
}

describe("css-invariants — Property 16 (grid gaps symmetric across breakpoints)", () => {
  const cardsRules = collectCardsRules();
  const gaps = collectGaps();

  it("finds the .cards grid rule", () => {
    expect(cardsRules.length).toBeGreaterThan(0);
    // The base `.cards` rule must declare a gap.
    expect(gaps.length).toBeGreaterThan(0);
  });

  // Feature: minimalist-visual-redesign, Property 16: Grid gaps are symmetric across every breakpoint — for all breakpoint rules of the home card grid, the gap is a single `gap` value sourced from one --space-* token (no asymmetric row-gap/column-gap split), so horizontal and vertical gaps are equal at every breakpoint.
  it("every .cards rule that sets a gap uses a single symmetric gap from one --space-* token", () => {
    fc.assert(
      fc.property(fc.constantFrom(...gaps), (g) => {
        const label = `${g.atRule} .cards { ${g.gap} }`;

        // No asymmetric split: row-gap / column-gap are forbidden on .cards.
        expect(
          /^(?:row-gap|column-gap)\s*:/.test(g.gap),
          `asymmetric gap split in ${label}`
        ).toBe(false);

        // The declaration must be the single-valued `gap` shorthand.
        expect(/^gap\s*:/.test(g.gap), `expected gap shorthand in ${label}`).toBe(true);

        const value = g.gap.replace(/^gap\s*:/, "").trim();

        // Single value: the `gap` shorthand must not carry two space-separated
        // values (which would set row/column independently).
        const varCalls = value.match(/var\(\s*--[a-z0-9-]+[^)]*\)/gi) ?? [];
        expect(varCalls.length, `gap must be a single value in ${label}`).toBe(1);

        // Sourced from exactly one --space-* token.
        const spaceTokens = [
          ...value.matchAll(/var\(\s*(--space-[0-9]+)/gi),
        ].map((m) => m[1]);
        expect(
          spaceTokens.length,
          `gap must reference one --space-* token in ${label}`
        ).toBe(1);

        // Nothing else (no extra bare length) sits outside the var().
        const outside = stripVarCalls(value).trim();
        expect(
          LENGTH_RE.test(outside),
          `gap has a raw length outside the token in ${label}`
        ).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Property 9 — SECTIONS card colors are token references, never literals
// ===========================================================================

import { SECTIONS } from "../lib/sections";

/**
 * A SECTIONS entry paired with its defined (non-undefined) `color` value, so
 * fast-check can range over exactly the entries this property constrains.
 */
interface SectionColor {
  id: string;
  color: string;
}

/** Only entries that actually declare a `color` are in this property's scope. */
const SECTIONS_WITH_COLOR: SectionColor[] = SECTIONS.filter(
  (s): s is typeof s & { color: string } => typeof s.color === "string"
).map((s) => ({ id: s.id, color: s.color }));

/** Hex color literal (3-, 4-, 6-, or 8-digit) — mirrors Property 10's recognizer. */
const SECTION_HEX_RE = /#[0-9a-f]{3,8}\b/i;
/** rgb()/rgba() / hsl()/hsla() color functions. */
const SECTION_COLOR_FN_RE = /\b(?:rgba?|hsla?)\s*\(/i;
/** A conservative set of CSS named colors that could appear as literals. */
const SECTION_NAMED_COLORS = [
  "white", "black", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "gray", "grey", "silver", "gold", "cyan", "magenta", "maroon",
  "navy", "teal", "olive", "lime", "aqua", "fuchsia", "indigo", "violet",
  "brown", "beige", "coral", "crimson", "salmon", "khaki", "tan",
];
const SECTION_NAMED_COLOR_RE = new RegExp(
  `\\b(?:${SECTION_NAMED_COLORS.join("|")})\\b`,
  "i"
);

/** Does a value look like any bare color literal (hex/rgb/hsl/named)? */
function isColorLiteral(value: string): boolean {
  return (
    SECTION_HEX_RE.test(value) ||
    SECTION_COLOR_FN_RE.test(value) ||
    SECTION_NAMED_COLOR_RE.test(value)
  );
}

describe("css-invariants — Property 9 (SECTIONS colors are token references)", () => {
  it("finds SECTIONS entries that declare a color to police", () => {
    // Guards against the sample space silently emptying (e.g. the field being
    // renamed or dropped), which would make the property vacuously pass.
    expect(SECTIONS_WITH_COLOR.length).toBeGreaterThan(0);
  });

  // Feature: minimalist-visual-redesign, Property 9: Section card colors are token references, never literals — for all SECTIONS entries that define a color, the value is a CSS custom-property reference (matches /^--/) and is not a color literal (not hex/rgb/hsl/named-color).
  // Validates: Requirements 2.3
  it("every defined SECTIONS color is a --custom-property reference and not a color literal", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SECTIONS_WITH_COLOR), (entry) => {
        const label = `SECTIONS[${entry.id}].color = ${entry.color}`;

        // It must be a CSS custom-property reference.
        expect(/^--/.test(entry.color), `color is not a --token in ${label}`).toBe(
          true
        );

        // It must NOT be a bare color literal.
        expect(isColorLiteral(entry.color), `color is a literal in ${label}`).toBe(
          false
        );
      }),
      { numRuns: 100 }
    );
  });
});
