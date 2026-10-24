import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Button-consistency tests for the minimalist visual redesign (task 10.2).
 *
 * Requirement 5.3: every primary button across all pages uses the `.btn-primary`
 * style (a single shared source), so background color, text color, and corner
 * radius are identical across all instances.
 *
 * Requirement 5.4: the hover treatment is defined once per variant by the shared
 * button styles, so all buttons of the same variant resolve an identical hover
 * state. We assert exactly one `.btn:hover` rule and exactly one
 * `.btn-primary:hover` rule exist in `global.css` — one hover rule per variant.
 *
 * jsdom performs no layout and does not resolve the `var()` cascade, so these
 * tests parse the stylesheet *text* (read from disk) rather than measuring
 * computed geometry. Paths are resolved relative to this test file's own
 * directory via `import.meta.url`, so the tests are independent of the cwd
 * Vitest is launched from.
 */

/** Directory this test file lives in (…/client/src/styles). */
const HERE = path.dirname(new URL(import.meta.url).pathname);

/** Read a file whose path is given relative to this test file's dir. */
function read(relPath: string): string {
  return readFileSync(path.resolve(HERE, relPath), "utf8");
}

/** Strip `/* … *\/` comments so selectors inside comments are never counted. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Count the number of rule *preludes* (the text before a `{`) whose selector
 * list contains the given selector as a standalone part. We match against the
 * comma-separated selector parts so, e.g., `.btn:hover` is counted but
 * `.btn-primary:hover` is not mistaken for a `.btn:hover` occurrence.
 */
function countRulePreludes(css: string, selectorRe: RegExp): number {
  const clean = stripComments(css);
  let count = 0;
  // Walk brace-delimited blocks at any depth; capture each prelude that
  // immediately precedes a `{`.
  let segStart = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "{" || ch === "}") {
      if (ch === "{") {
        const prelude = clean.slice(segStart, i).trim();
        // Skip at-rule preludes (e.g. @media); they are not selector rules.
        if (prelude && !prelude.startsWith("@")) {
          const parts = prelude.split(",").map((p) => p.trim());
          if (parts.some((p) => selectorRe.test(p))) count++;
        }
      }
      segStart = i + 1;
    }
  }
  return count;
}

const globalCss = read("global.css");

describe("button-consistency — one hover rule per variant (Req 5.4)", () => {
  it("global.css has exactly one `.btn:hover` rule", () => {
    // Match a prelude that is exactly `.btn:hover` (not `.btn-primary:hover`).
    const count = countRulePreludes(globalCss, /^\.btn:hover$/);
    expect(count).toBe(1);
  });

  it("global.css has exactly one `.btn-primary:hover` rule", () => {
    const count = countRulePreludes(globalCss, /^\.btn-primary:hover$/);
    expect(count).toBe(1);
  });
});

describe("button-consistency — .btn-primary is a single token-sourced source (Req 5.3)", () => {
  it("global.css defines exactly one base `.btn-primary` rule block", () => {
    // The base rule is `.btn-primary` with no pseudo-class. The `:hover` and
    // `:focus-visible` rules are separate pseudo-class preludes and are not
    // counted here.
    const count = countRulePreludes(globalCss, /^\.btn-primary$/);
    expect(count).toBe(1);
  });

  it("the base `.btn-primary` rule sources background, color and radius from tokens", () => {
    const clean = stripComments(globalCss);
    // Extract the body of the base `.btn-primary { … }` rule.
    const match = clean.match(/(^|[\s}])\.btn-primary\s*\{([^}]*)\}/);
    expect(match, "base .btn-primary rule not found").not.toBeNull();
    const body = match![2];

    const decl = (prop: string): string => {
      const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:([^;]*)`, "i");
      const m = body.match(re);
      return m ? m[1].trim() : "";
    };

    const background = decl("background");
    const color = decl("color");
    const radius = decl("border-radius");

    expect(background, "background declaration missing").not.toBe("");
    expect(color, "color declaration missing").not.toBe("");
    expect(radius, "border-radius declaration missing").not.toBe("");

    // Each must reference a design token via var(--...).
    expect(/var\(\s*--/.test(background), `background not token-sourced: ${background}`).toBe(true);
    expect(/var\(\s*--/.test(color), `color not token-sourced: ${color}`).toBe(true);
    expect(/var\(\s*--/.test(radius), `border-radius not token-sourced: ${radius}`).toBe(true);
  });
});

describe("button-consistency — primary buttons all carry .btn-primary (Req 5.3)", () => {
  /**
   * Files that render a primary button. Every primary button must use the
   * shared `.btn-primary` class (the single source), not a bespoke style.
   */
  const PRIMARY_BUTTON_FILES: readonly string[] = [
    "../pages/NotFoundPage.tsx",
    "../pages/ConnectPage.tsx",
    "../features/voting/MatchQuiz.tsx",
  ];

  it("each known primary-button file references the shared `btn-primary` class", () => {
    for (const file of PRIMARY_BUTTON_FILES) {
      const src = read(file);
      expect(
        /\bbtn-primary\b/.test(src),
        `${file} does not use the shared btn-primary class`
      ).toBe(true);
      // The primary variant is always composed on top of the base `.btn`
      // class, keeping the shared padding/radius/transition.
      expect(
        /btn\s+btn-primary|btn btn-primary/.test(src),
        `${file} should compose btn-primary with the base btn class`
      ).toBe(true);
    }
  });
});
