import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Typography and spacing-rhythm tests for the minimalist visual redesign
 * (tasks.md 10.3).
 *
 * jsdom performs no layout and does not resolve the `var()` cascade, so — as in
 * css-invariants.test.ts — these tests parse the stylesheet *text* (read from
 * disk) rather than measuring computed geometry. Every path is resolved
 * relative to this test file's own directory via `import.meta.url`, so the
 * tests are independent of the cwd Vitest is launched from.
 *
 * Assertions (presentation-only redesign):
 *   1. global.css `body`: font-family references var(--font-sans); line-height
 *      numeric value ∈ [1.5, 1.8].                      (Req 6.1, 6.2)
 *   2. global.css `.prose` long-form container: max-width is a `ch` value in
 *      [60, 80].                                         (Req 6.3)
 *   3. PageHeader.module.css `.header`: the spacing to the following content
 *      (margin-bottom) is sourced from a single --space-* token.  (Req 7.2)
 *   4. HomePage.module.css `.cards`: the gap between stacked cards/groups
 *      references a single --space-* token.             (Req 7.3)
 *   5. global.css `.card`: box-shadow references a --shadow-* token. (Req 7.4)
 *
 * _Requirements: 6.1, 6.2, 6.3, 7.2, 7.3, 7.4_
 */

// ===========================================================================
// Shared CSS text helpers (text-parsing, no layout)
// ===========================================================================

/** Directory this test file lives in (…/client/src/styles). */
const HERE = path.dirname(new URL(import.meta.url).pathname);

/** Read a CSS file whose path is given relative to this test file's dir. */
function readCss(relPath: string): string {
  return readFileSync(path.resolve(HERE, relPath), "utf8");
}

/** Strip `/* … *\/` comments so values inside comments are never parsed. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** A single `property: value` declaration parsed from a rule body. */
interface Declaration {
  prop: string;
  value: string;
}

interface Rule {
  selector: string;
  body: string;
  /** The at-rule condition this rule was nested in, if any. */
  atRule: string | null;
}

/**
 * Extract every rule in a stylesheet as `{ selector, body, atRule }`,
 * flattening the bodies of top-level at-rules (e.g. `@media`) so their inner
 * rules surface as ordinary rules. Mirrors the parser in css-invariants.test.ts
 * so both suites read the stylesheet the same way.
 */
function extractRules(css: string): Rule[] {
  const clean = stripComments(css);
  const rules: Rule[] = [];
  const n = clean.length;

  function parseBlock(atRule: string | null, start: number): number {
    let j = start;
    let segStart = j;
    while (j < n) {
      const ch = clean[j];
      if (ch === "{") {
        const prelude = clean.slice(segStart, j).trim();
        if (/^@/.test(prelude)) {
          j = parseBlock(prelude, j + 1);
          segStart = j;
          continue;
        }
        const bodyStart = j + 1;
        let depth = 1;
        let k = bodyStart;
        while (k < n && depth > 0) {
          if (clean[k] === "{") depth++;
          else if (clean[k] === "}") depth--;
          if (depth === 0) break;
          k++;
        }
        rules.push({ selector: prelude, body: clean.slice(bodyStart, k), atRule });
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

  let i = 0;
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

/** Parse the top-level declarations inside a rule body. */
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
 * Find the body of the first rule whose selector contains the given
 * class/element token as a standalone selector part. Searches the base scope
 * and any flattened at-rule. Returns null when absent.
 */
function findRule(css: string, selectorPattern: RegExp): Rule | null {
  return extractRules(css).find((r) => selectorPattern.test(r.selector)) ?? null;
}

/** Read the last-declared value of `prop` within a rule body, or null. */
function declValue(rule: Rule, prop: string): string | null {
  let value: string | null = null;
  for (const decl of parseDeclarations(rule.body)) {
    if (decl.prop === prop) value = decl.value;
  }
  return value;
}

// ===========================================================================
// 1. body — font-family token + body line-height in [1.5, 1.8]
// ===========================================================================

describe("typography — body base family and line-height", () => {
  const css = readCss("global.css");
  // Match a `body` rule: either `body` alone or `html, body` reset is a
  // different rule, so require a standalone `body` selector that is not part of
  // the `html,\nbody { margin:0 }` reset by picking the rule that sets
  // font-family.
  const bodyRules = extractRules(css).filter((r) =>
    /(^|[\s,>+~])body(\s|$|[,{:>+~])/.test(r.selector + " ")
  );

  it("locates a body rule that sets font-family and line-height", () => {
    expect(bodyRules.length).toBeGreaterThan(0);
    const styled = bodyRules.find(
      (r) => declValue(r, "font-family") && declValue(r, "line-height")
    );
    expect(styled, "expected a body rule declaring font-family + line-height").toBeTruthy();
  });

  it("body font-family references the --font-sans token", () => {
    const rule = bodyRules.find((r) => declValue(r, "font-family"));
    expect(rule).toBeTruthy();
    const fontFamily = declValue(rule!, "font-family")!;
    // The value must reference var(--font-sans[,…]) rather than a bare family
    // stack. A system fallback inside the var() second argument is permitted.
    expect(
      /var\(\s*--font-sans\b/i.test(fontFamily),
      `body font-family must reference var(--font-sans), got: ${fontFamily}`
    ).toBe(true);
  });

  it("body line-height is a unitless number within [1.5, 1.8]", () => {
    const rule = bodyRules.find((r) => declValue(r, "line-height"));
    expect(rule).toBeTruthy();
    const lineHeight = declValue(rule!, "line-height")!.trim();

    // Body line-height is expected to be a unitless multiplier (e.g. 1.6).
    const match = lineHeight.match(/^(\d*\.?\d+)$/);
    expect(
      match,
      `body line-height should be a unitless number, got: ${lineHeight}`
    ).toBeTruthy();

    const value = Number(match![1]);
    // Report (not loosen) if the committed value leaves the readability band.
    expect(
      value >= 1.5 && value <= 1.8,
      `body line-height ${value} is outside the [1.5, 1.8] readability band`
    ).toBe(true);
  });
});

// ===========================================================================
// 2. .prose — long-form measure 60–80ch
// ===========================================================================

describe("typography — long-form prose container measure", () => {
  const css = readCss("global.css");
  const prose = findRule(css, /(^|[\s,>+~])\.prose(\s|$|[,{:>+~])/);

  it("defines a .prose long-form container with a max-width", () => {
    expect(prose, "expected a .prose rule in global.css").toBeTruthy();
    expect(declValue(prose!, "max-width"), "expected .prose to set max-width").toBeTruthy();
  });

  it(".prose max-width is a ch measure within [60, 80]", () => {
    const maxWidth = declValue(prose!, "max-width")!.trim();

    const match = maxWidth.match(/(\d*\.?\d+)\s*ch\b/i);
    expect(
      match,
      `.prose max-width should be a ch value, got: ${maxWidth}`
    ).toBeTruthy();

    const value = Number(match![1]);
    // Report (not loosen) if the committed measure leaves the 60–80ch band.
    expect(
      value >= 60 && value <= 80,
      `.prose max-width ${value}ch is outside the [60, 80ch] readability range`
    ).toBe(true);
  });
});

// ===========================================================================
// 3. PageHeader .header — spacing to content from one --space-* token
// ===========================================================================

describe("spacing-rhythm — PageHeader header-to-content gap", () => {
  const css = readCss("../components/PageHeader.module.css");
  const header = findRule(css, /(^|[\s,>+~])\.header(\s|$|[,{:>+~])/);

  it("defines a .header rule", () => {
    expect(header, "expected a .header rule in PageHeader.module.css").toBeTruthy();
  });

  it("header bottom spacing to content references a single --space-* token", () => {
    // Prefer margin-bottom; fall back to the margin shorthand if the header
    // expresses its spacing to the following content differently.
    const marginBottom = declValue(header!, "margin-bottom");
    const margin = declValue(header!, "margin");
    const spacing = marginBottom ?? margin;

    expect(
      spacing,
      "expected .header to set margin-bottom (or margin) for its gap to content"
    ).toBeTruthy();

    const spaceTokens = [
      ...spacing!.matchAll(/var\(\s*(--space-[0-9]+)\b/gi),
    ].map((m) => m[1]);

    // Exactly one --space-* token sources the gap (single rhythm step).
    expect(
      spaceTokens.length,
      `header spacing must reference exactly one --space-* token, got: ${spacing}`
    ).toBe(1);

    // No bare length sits outside the token (would break the rhythm scale).
    const outside = spacing!.replace(/var\(\s*--[a-z0-9-]+[^)]*\)/gi, " ").trim();
    expect(
      /-?\d*\.?\d+(px|rem|em|ch|vh|vw|%)\b/i.test(outside),
      `header spacing has a raw length outside the token: ${spacing}`
    ).toBe(false);
  });
});

// ===========================================================================
// 4. HomePage .cards — stacked-card/group gap from one --space-* token
// ===========================================================================

describe("spacing-rhythm — stacked-card/group gap", () => {
  const css = readCss("../pages/HomePage.module.css");
  // The base `.cards` grid rule carries the gap between stacked cards/groups.
  const cardsRules = extractRules(css).filter((r) =>
    /(^|[\s,>+~])\.cards(\s|$|[,{:>+~])/.test(r.selector + " ")
  );

  it("locates the .cards grid rule with a gap", () => {
    expect(cardsRules.length).toBeGreaterThan(0);
    const withGap = cardsRules.find((r) => declValue(r, "gap"));
    expect(withGap, "expected a .cards rule declaring gap").toBeTruthy();
  });

  it("the card-group gap references a single --space-* token", () => {
    const withGap = cardsRules.find((r) => declValue(r, "gap"))!;
    const gap = declValue(withGap, "gap")!.trim();

    // A single-valued gap shorthand (no space-separated row/column split).
    const varCalls = gap.match(/var\(\s*--[a-z0-9-]+[^)]*\)/gi) ?? [];
    expect(varCalls.length, `gap must be a single value, got: ${gap}`).toBe(1);

    const spaceTokens = [...gap.matchAll(/var\(\s*(--space-[0-9]+)\b/gi)].map(
      (m) => m[1]
    );
    expect(
      spaceTokens.length,
      `gap must reference one --space-* token, got: ${gap}`
    ).toBe(1);
  });
});

// ===========================================================================
// 5. .card — soft shadow from a --shadow-* token
// ===========================================================================

describe("spacing-rhythm — card soft shadow token", () => {
  const css = readCss("global.css");
  // The shared `.card` surface class lives in global.css (not the page-local
  // HomePage `.card`). Pick the rule whose selector is exactly `.card`.
  const card = extractRules(css).find((r) => r.selector.trim() === ".card");

  it("defines the shared .card rule with a box-shadow", () => {
    expect(card, "expected a `.card` rule in global.css").toBeTruthy();
    expect(declValue(card!, "box-shadow"), "expected .card to set box-shadow").toBeTruthy();
  });

  it(".card box-shadow references a --shadow-* token", () => {
    const boxShadow = declValue(card!, "box-shadow")!.trim();
    const shadowTokens = [
      ...boxShadow.matchAll(/var\(\s*(--shadow-[a-z0-9-]+)\b/gi),
    ].map((m) => m[1]);

    expect(
      shadowTokens.length,
      `.card box-shadow must reference a --shadow-* token, got: ${boxShadow}`
    ).toBeGreaterThan(0);
    // Sanity: the referenced token is one of the committed shadow tokens.
    for (const name of shadowTokens) {
      expect(
        /^--shadow-(sm|md|lg)$/.test(name),
        `.card box-shadow references unexpected token ${name}`
      ).toBe(true);
    }
  });
});
