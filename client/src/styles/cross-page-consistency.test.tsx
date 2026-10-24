import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import App from "../App";
import PageHeader from "../components/PageHeader";
import { SettingsProvider } from "../context/SettingsContext";
import { FollowProvider } from "../context/FollowContext";
import { CausesProvider } from "../context/CausesContext";

/**
 * Cross-page visual-consistency tests for the minimalist visual redesign
 * (Requirements 8.1, 8.3, 8.4, 8.5, 8.6).
 *
 * The redesign's promise is "one cohesive product": palette tokens live in a
 * single source of truth, the shared `PageHeader` renders identical structure
 * everywhere it is used, and a theme change is nothing more than flipping the
 * `[data-theme]` attribute on <html> — no page supplies its own color
 * overrides. These tests assert those three mechanisms.
 *
 * jsdom performs no layout and does not resolve the `var()` cascade, so the
 * token-ownership assertions parse the stylesheet *text* read from disk rather
 * than measuring computed styles. The theme-flip assertion exercises the real
 * component tree (SettingsContext reflects `theme` onto <html data-theme>).
 */

// ===========================================================================
// Shared render harness (mirrors App.test.tsx)
// ===========================================================================

function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SettingsProvider>
        <FollowProvider>
          <CausesProvider>
            <App />
          </CausesProvider>
        </FollowProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  // Route-aware fetch stub so each endpoint returns a plausibly-shaped payload.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = (() => {
        if (url.includes("/api/health"))
          return { status: "ok", service: "test" };
        if (url.includes("/api/ai/status")) return { aiEnabled: false };
        return [];
      })();
      return {
        ok: true,
        status: 200,
        json: async () => body,
      };
    }) as unknown as typeof fetch
  );
  window.localStorage.clear();
  // Reset the theme attribute so the flip test starts from a known baseline.
  document.documentElement.removeAttribute("data-theme");
});

// ===========================================================================
// 1. Palette tokens are defined only in global.css (Req 8.1, 8.6)
// ===========================================================================

/** Directory this test file lives in (…/client/src/styles). */
const HERE = path.dirname(new URL(import.meta.url).pathname);
/** The client/src root — one level up from the styles directory. */
const SRC_ROOT = path.resolve(HERE, "..");

/** Strip `/* … *\/` comments so declarations inside comments are ignored. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Recursively collect every `*.module.css` file under the client/src root. */
function findModuleCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findModuleCssFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".module.css")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Match a *definition* of a `--color-*` custom property — i.e. the token name
 * appearing on the left of a `:` as a declaration (`--color-x: value;`).
 * A *reference* via `var(--color-x)` never places the token immediately before
 * a colon, so this pattern does not match references.
 */
const COLOR_TOKEN_DEFINITION_RE = /--color-[a-z0-9-]+\s*:/gi;

describe("cross-page consistency — palette tokens live only in global.css", () => {
  const moduleCssFiles = findModuleCssFiles(SRC_ROOT);

  it("discovers the module css files to scan", () => {
    // Guard against the walk silently returning nothing (which would make the
    // ownership assertion vacuously pass).
    expect(moduleCssFiles.length).toBeGreaterThan(0);
    // A couple of known modules must be present so we know we scanned the tree.
    const names = moduleCssFiles.map((f) => path.basename(f));
    expect(names).toContain("HomePage.module.css");
    expect(names).toContain("PageHeader.module.css");
  });

  it("no page/component module.css defines a --color-* token (only global.css may)", () => {
    const offenders: string[] = [];
    for (const file of moduleCssFiles) {
      const css = stripComments(readFileSync(file, "utf8"));
      const matches = css.match(COLOR_TOKEN_DEFINITION_RE);
      if (matches && matches.length > 0) {
        offenders.push(
          `${path.relative(SRC_ROOT, file)} defines ${matches.join(", ")}`
        );
      }
    }
    expect(offenders, `--color-* must be defined only in global.css`).toEqual(
      []
    );
  });

  it("global.css is the source that defines the --color-* palette tokens", () => {
    // Sanity: the single source of truth really does define the palette, so the
    // "defined only in global.css" claim is meaningful and not vacuous.
    const globalCss = stripComments(
      readFileSync(path.resolve(HERE, "global.css"), "utf8")
    );
    const defs = globalCss.match(COLOR_TOKEN_DEFINITION_RE) ?? [];
    expect(defs.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 2. Shared PageHeader structure is identical across pages (Req 8.3, 8.5)
// ===========================================================================

describe("cross-page consistency — shared PageHeader structure", () => {
  it("renders the same wrapper structure and classes for different pages", () => {
    const { container: a } = render(
      <PageHeader icon="voting" title="Voting" subtitle="How voting works" />
    );
    const { container: b } = render(
      <PageHeader icon="causes" title="Causes" subtitle="Local causes" />
    );

    const headerA = a.querySelector("header");
    const headerB = b.querySelector("header");

    // Both render a <header> wrapper with the same (shared-component) class.
    expect(headerA).not.toBeNull();
    expect(headerB).not.toBeNull();
    expect(headerA!.className).toBe(headerB!.className);

    // Both render an <h1> title with the same class.
    const h1A = a.querySelector("h1");
    const h1B = b.querySelector("h1");
    expect(h1A).not.toBeNull();
    expect(h1B).not.toBeNull();
    expect(h1A!.className).toBe(h1B!.className);

    // The title text differs per page (content), but the structure does not.
    expect(h1A!.textContent).toContain("Voting");
    expect(h1B!.textContent).toContain("Causes");

    // Both render a vector icon (svg), not an emoji glyph.
    expect(a.querySelector("svg")).not.toBeNull();
    expect(b.querySelector("svg")).not.toBeNull();

    // Both render the subtitle with the same class.
    const subA = a.querySelector("p");
    const subB = b.querySelector("p");
    expect(subA).not.toBeNull();
    expect(subB).not.toBeNull();
    expect(subA!.className).toBe(subB!.className);
  });

  it("uses the same single PageHeader source on real feature pages", async () => {
    // Voting and Causes pages both mount the shared PageHeader; their <h1>
    // wrapper class must match, proving one shared styling source (Req 8.5).
    const { container: voting } = renderApp("/voting");
    const votingHeading = await screen.findByRole("heading", {
      name: "Voting",
      level: 1,
    });

    const { container: causes } = renderApp("/causes");
    const causesHeading = await screen.findByRole("heading", {
      name: "Causes",
      level: 1,
    });

    expect(votingHeading.className).toBe(causesHeading.className);
    // Each page's header carries a vector icon.
    expect(voting.querySelector("header svg")).not.toBeNull();
    expect(causes.querySelector("header svg")).not.toBeNull();
  });
});

// ===========================================================================
// 3. Theme flip is driven by [data-theme] on <html> (Req 8.4)
// ===========================================================================

describe("cross-page consistency — theme flip via data-theme attribute", () => {
  it("flips documentElement data-theme when the theme toggle is clicked", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const toggle = await screen.findByRole("button", {
      name: /switch to .* mode/i,
    });

    // Baseline: SettingsContext reflects the initial theme onto <html>. In the
    // jsdom test environment matchMedia is unset, so the initial theme is
    // "light".
    const initial = document.documentElement.getAttribute("data-theme");
    expect(initial).toBe("light");

    // One click flips the attribute to the other theme.
    await user.click(toggle);
    const afterFirst = document.documentElement.getAttribute("data-theme");
    expect(afterFirst).toBe("dark");
    expect(afterFirst).not.toBe(initial);

    // Clicking again flips it back — the attribute is the sole color mechanism.
    await user.click(toggle);
    const afterSecond = document.documentElement.getAttribute("data-theme");
    expect(afterSecond).toBe("light");
    expect(afterSecond).toBe(initial);
  });

  it("colors are token-driven: no page module redefines the palette, so the attribute flip alone re-themes", () => {
    // The theme change is token-driven: because no page module defines a
    // --color-* token (asserted above), flipping [data-theme] on <html> — which
    // only re-binds the global.css palette tokens — is sufficient to re-theme
    // every page, with no per-page color override required (Req 8.4).
    const moduleCssFiles = findModuleCssFiles(SRC_ROOT);
    for (const file of moduleCssFiles) {
      const css = stripComments(readFileSync(file, "utf8"));
      expect(
        COLOR_TOKEN_DEFINITION_RE.test(css),
        `${path.relative(SRC_ROOT, file)} must not redefine palette tokens`
      ).toBe(false);
      // Reset lastIndex because the regex is declared with the /g flag.
      COLOR_TOKEN_DEFINITION_RE.lastIndex = 0;
    }
  });
});
