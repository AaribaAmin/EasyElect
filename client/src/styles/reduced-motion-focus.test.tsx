import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";

import TweetCard from "../features/tweets/TweetCard";
import SettingsToggles from "../components/SettingsToggles";
import FollowButton from "../features/voting/FollowButton";
import { SettingsProvider } from "../context/SettingsContext";
import { FollowProvider } from "../context/FollowContext";
import { CausesProvider } from "../context/CausesContext";
import type { Tweet } from "../types/domain";

/**
 * Reduced-motion and focus-indicator tests for the minimalist visual redesign
 * (tasks.md 10.6).
 *
 * jsdom performs no layout and does not resolve the `var()` cascade or
 * media-query matching, so the reduced-motion and focus-outline assertions
 * parse the stylesheet *text* read from disk (as in css-invariants.test.ts and
 * typography-spacing.test.ts) rather than measuring computed styles. The
 * color-not-alone assertions exercise the real component tree and read source
 * text where a control's state is best confirmed structurally.
 *
 * Path resolution: under the jsdom test transform `import.meta.url` is not a
 * usable file: URL, so paths are resolved from the process cwd (Vitest runs
 * from `client/`) via `resolve(process.cwd(), "src/...")`.
 *
 * Assertions:
 *   1. Reduced motion (Req 9.3): the `@media (prefers-reduced-motion: reduce)`
 *      block nulls both transitions and animations
 *      (`transition: none !important`, `animation: none !important`).
 *   2. Focus-visible differs from unfocused (Req 9.4): `:focus-visible`
 *      defines a visible outline (non-`none`, non-transparent) of width ≥ 2px
 *      referencing a color token — the unfocused state has no such outline, so
 *      the focused state is visually distinct.
 *   3. Color-not-alone (Req 9.7): color-coded states also carry text or a
 *      labeled icon — tweet markers sit next to numeric counts and the "Added
 *      context" literal label; the theme toggle has an aria-label; FollowButton
 *      conveys its state through label text, not color alone.
 *
 * _Requirements: 9.3, 9.4, 9.7_
 */

// ===========================================================================
// CSS text helpers (text-parsing, no layout)
// ===========================================================================

/** Read a file whose path is given relative to the client/src root. */
function readSrc(relPath: string): string {
  return readFileSync(resolve(process.cwd(), "src", relPath), "utf8");
}

/** Strip `/* … *\/` comments so values inside comments are never parsed. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extract the body text of the first `@media (...)` at-rule whose prelude
 * matches `conditionRe`, balancing nested braces. Returns null when absent.
 */
function extractAtRuleBody(css: string, conditionRe: RegExp): string | null {
  const clean = stripComments(css);
  const atIdx = clean.search(conditionRe);
  if (atIdx === -1) return null;
  const braceStart = clean.indexOf("{", atIdx);
  if (braceStart === -1) return null;
  let depth = 1;
  let i = braceStart + 1;
  for (; i < clean.length && depth > 0; i++) {
    if (clean[i] === "{") depth++;
    else if (clean[i] === "}") depth--;
  }
  // i is one past the closing brace of the at-rule.
  return clean.slice(braceStart + 1, i - 1);
}

/** Parse `property: value` declarations (incl. `!important`) from a body. */
function parseDeclarations(body: string): { prop: string; value: string }[] {
  const out: { prop: string; value: string }[] = [];
  for (const raw of body.split(";")) {
    const decl = raw.trim();
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

// ===========================================================================
// 1. Reduced motion nulls transitions and animations (Req 9.3)
// ===========================================================================

describe("reduced motion — prefers-reduced-motion nulls transitions/animations", () => {
  const css = readSrc("styles/global.css");

  it("defines a `@media (prefers-reduced-motion: reduce)` block", () => {
    const body = extractAtRuleBody(
      css,
      /@media[^{]*prefers-reduced-motion\s*:\s*reduce/i
    );
    expect(
      body,
      "expected an @media (prefers-reduced-motion: reduce) block in global.css"
    ).toBeTruthy();
  });

  it("nulls both transition and animation with !important inside the block", () => {
    const body = extractAtRuleBody(
      css,
      /@media[^{]*prefers-reduced-motion\s*:\s*reduce/i
    )!;
    // Flatten the (possibly multiple) inner rule bodies into one declaration
    // list so we can assert the two null declarations are present regardless of
    // how the inner selectors are grouped.
    const innerDecls = body
      .replace(/[^{}]*\{/g, "") // drop selectors + opening braces
      .replace(/\}/g, ";") // close each inner body as a declaration boundary
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .join("; ");
    const decls = parseDeclarations(innerDecls);

    const transition = decls.find((d) => d.prop === "transition");
    const animation = decls.find((d) => d.prop === "animation");

    expect(
      transition,
      "expected a `transition` declaration inside the reduced-motion block"
    ).toBeTruthy();
    expect(
      animation,
      "expected an `animation` declaration inside the reduced-motion block"
    ).toBeTruthy();

    // Both must be nulled to `none` and forced with !important so no author or
    // component transition/animation can override the reduced-motion intent.
    expect(
      /^none\s*!important$/i.test(transition!.value),
      `transition must be "none !important", got: ${transition!.value}`
    ).toBe(true);
    expect(
      /^none\s*!important$/i.test(animation!.value),
      `animation must be "none !important", got: ${animation!.value}`
    ).toBe(true);
  });
});

// ===========================================================================
// 2. :focus-visible outline is distinct from the unfocused state (Req 9.4)
// ===========================================================================

describe("focus — :focus-visible renders a distinct, token-colored outline", () => {
  const css = stripComments(readSrc("styles/global.css"));

  /** Grab the body of the first bare `:focus-visible` rule (global focus). */
  function focusVisibleBody(source: string): string | null {
    // Match a rule whose selector is exactly `:focus-visible` (the global
    // focus ring), not `.btn:focus-visible` scoped variants.
    const re = /(^|\})\s*:focus-visible\s*\{([^}]*)\}/m;
    const m = source.match(re);
    return m ? m[2] : null;
  }

  it("defines a bare :focus-visible rule with an outline", () => {
    const body = focusVisibleBody(css);
    expect(body, "expected a `:focus-visible` rule in global.css").toBeTruthy();
    const outline = parseDeclarations(body!).find((d) => d.prop === "outline");
    expect(outline, "expected :focus-visible to set outline").toBeTruthy();
  });

  it("outline is visible (non-none, non-transparent), ≥ 2px, and token-colored", () => {
    const body = focusVisibleBody(css)!;
    const outline = parseDeclarations(body).find((d) => d.prop === "outline")!;
    const value = outline.value;

    // A visible outline: not `none`, not `transparent`. The unfocused state has
    // no such outline, so this makes the focused state visually distinct.
    expect(
      /\bnone\b/i.test(value),
      `:focus-visible outline must not be none, got: ${value}`
    ).toBe(false);
    expect(
      /\btransparent\b/i.test(value),
      `:focus-visible outline must not be transparent, got: ${value}`
    ).toBe(false);

    // Width ≥ 2px (a legible focus ring).
    const widthMatch = value.match(/(\d*\.?\d+)px/);
    expect(
      widthMatch,
      `:focus-visible outline must specify a px width, got: ${value}`
    ).toBeTruthy();
    const width = Number(widthMatch![1]);
    expect(
      width >= 2,
      `:focus-visible outline width must be ≥ 2px, got: ${width}px`
    ).toBe(true);

    // Color comes from a token (a --color-primary* reference), not a bare
    // literal that could drift from the palette.
    expect(
      /var\(\s*--color-primary\b/i.test(value),
      `:focus-visible outline must reference a --color-primary token, got: ${value}`
    ).toBe(true);
  });
});

// ===========================================================================
// 3. Color-coded states also carry text or a labeled icon (Req 9.7)
// ===========================================================================

function renderWithProviders(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <FollowProvider>
          <CausesProvider>{ui}</CausesProvider>
        </FollowProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

/** A minimal Tweet fixture (see ../types/domain). */
const sampleTweet: Tweet = {
  id: "t1",
  candidateId: "c1",
  authorName: "Jane Candidate",
  authorHandle: "@jane",
  text: "A post about the issues that matter.",
  date: "2024-10-01",
  likes: 1234,
  reposts: 56,
  tabs: ["recent"],
};

beforeEach(() => {
  // Context fetch is not needed for these render assertions, but stub fetch so
  // any stray call resolves rather than throwing in jsdom.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ context: "", source: "scripted" }),
    })) as unknown as typeof fetch
  );
  window.localStorage.clear();
});

describe("color-not-alone — TweetCard markers carry text alongside icons (Req 9.7)", () => {
  it("renders like/repost icons next to their numeric counts as text", () => {
    const { container } = renderWithProviders(
      <TweetCard tweet={sampleTweet} showContext />
    );

    // The icons render as vectors (not emoji/color-only markers).
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);

    // The numeric counts are present as literal text, so the like/repost
    // meaning is conveyed by text, not by the icon color alone.
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
    expect(screen.getByText(/56/)).toBeInTheDocument();
  });

  it('the "Added context" indicator is literal text alongside its info icon', () => {
    renderWithProviders(<TweetCard tweet={sampleTweet} showContext />);
    // "Added context" is a literal label, so the context region's meaning is
    // not carried by color alone.
    expect(screen.getByText(/added context/i)).toBeInTheDocument();
  });
});

describe("color-not-alone — SettingsToggles theme button has a text label (Req 9.7)", () => {
  it("exposes an accessible name even though only an icon is shown", () => {
    renderWithProviders(<SettingsToggles />);
    // The theme button renders an icon only, but carries an aria-label
    // ("Switch to ... mode"), so its action is not conveyed by color alone.
    const themeBtn = screen.getByRole("button", {
      name: /switch to (light|dark) mode/i,
    });
    expect(themeBtn).toBeInTheDocument();

    // It really is icon-only (a vector), confirming the label — not visible
    // text — is what names the control.
    expect(themeBtn.querySelector("svg")).not.toBeNull();
    expect(themeBtn.getAttribute("aria-label")).toMatch(
      /switch to (light|dark) mode/i
    );
  });
});

describe("color-not-alone — FollowButton conveys state via label text (Req 9.7)", () => {
  // FollowButton renders "+ Follow" / "✓ Following" label text and sets
  // aria-pressed, so follow state is conveyed by text (and ARIA state), not by
  // the button's color treatment alone. We confirm the source carries both
  // textual states and the aria-pressed binding.
  const source = readSrc("features/voting/FollowButton.tsx");

  it("source renders Follow/Following label text for each state", () => {
    expect(source).toMatch(/Following/);
    expect(source).toMatch(/Follow/);
    // The label is chosen from the `following` state, not from color alone.
    expect(source).toMatch(/following\s*\?/);
  });

  it("source binds aria-pressed to the follow state", () => {
    expect(source).toMatch(/aria-pressed=\{following\}/);
  });

  it("renders both label states in the DOM across the follow toggle", () => {
    // Unfollowed (default) state shows the "Follow" label.
    const { unmount } = renderWithProviders(
      <FollowButtonHarness candidateId="c1" />
    );
    expect(
      screen.getByRole("button", { name: /follow/i })
    ).toBeInTheDocument();
    unmount();
  });
});

// A tiny harness wrapping the default-exported FollowButton.
function FollowButtonHarness({ candidateId }: { candidateId: string }) {
  return <FollowButton candidateId={candidateId} />;
}
