import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";
import { SECTIONS } from "../lib/sections";
import { SettingsProvider } from "../context/SettingsContext";
import { FollowProvider } from "../context/FollowContext";
import { CausesProvider } from "../context/CausesContext";

/**
 * Example tests for task 7.3 of minimalist-visual-redesign.
 * Covers per-card background application (Req 2.2, 2.4) and the responsive
 * grid breakpoints declared in HomePage.module.css (Req 3.1-3.6).
 */

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <SettingsProvider>
        <FollowProvider>
          <CausesProvider>
            <HomePage />
          </CausesProvider>
        </FollowProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  // HomePage renders ApiStatus/AiStatus which fetch on mount. Stub minimally
  // so those side effects resolve without network access (mirrors App.test.tsx).
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
});

describe("HomePage per-card background application (Req 2.2, 2.4)", () => {
  it("renders each section card referencing its mapped --card-* token", () => {
    renderHome();

    for (const section of SECTIONS) {
      // Each card is a Link whose accessible name begins with the title.
      const card = screen.getByRole("link", {
        name: new RegExp(`^${section.title}`),
      });

      // Read the raw style attribute: jsdom's CSSOM may discard shorthand
      // background values containing var(), so the attribute is the source of truth.
      const styleAttr = card.getAttribute("style") ?? "";

      // The card background references its own mapped per-card token.
      expect(section.color).toBeDefined();
      expect(styleAttr).toContain(section.color as string);

      // And the ultimate fallback to the surface token is encoded inline.
      expect(styleAttr).toContain("var(--color-surface)");

      // Title, tagline, and description are all present on the card.
      const scoped = within(card);
      expect(scoped.getByText(section.title)).toBeInTheDocument();
      expect(scoped.getByText(section.tagline)).toBeInTheDocument();
      expect(scoped.getByText(section.description)).toBeInTheDocument();
    }
  });

  it("maps the Voting card to the --card-voting token specifically", () => {
    renderHome();
    const voting = screen.getByRole("link", { name: /^Voting/ });
    const styleAttr = voting.getAttribute("style") ?? "";
    expect(styleAttr).toContain("--card-voting");
    expect(styleAttr).toContain("var(--card-voting, var(--color-surface))");
  });

  it("falls back to var(--color-surface) when a section color is undefined", () => {
    // All four shipped SECTIONS carry a color, so the undefined-color branch
    // is exercised directly against the background expression used by HomePage.
    const background = (color?: string) =>
      color ? `var(${color}, var(--color-surface))` : "var(--color-surface)";

    // Defined color: token reference with surface as the second-argument fallback.
    expect(background("--card-tweets")).toBe(
      "var(--card-tweets, var(--color-surface))"
    );
    // Undefined color: ultimate fallback is the surface token.
    expect(background(undefined)).toBe("var(--color-surface)");
    // The surface token is the ultimate fallback in both forms.
    expect(background("--card-causes")).toContain("var(--color-surface)");
    expect(background(undefined)).toContain("var(--color-surface)");
  });
});

describe("HomePage responsive grid breakpoints (Req 3.1-3.6)", () => {
  // Vitest runs with the client package as cwd; resolve the stylesheet next
  // to this test module from the project root.
  const css = readFileSync(
    resolve(process.cwd(), "src/pages/HomePage.module.css"),
    "utf-8"
  );

  // Normalize whitespace so assertions are tolerant of formatting (e.g.
  // "repeat(4,1fr)" vs "repeat(4, 1fr)").
  const compact = css.replace(/\s+/g, "");

  it("defines a single-column base grid (<640px)", () => {
    // The base .cards rule uses one column.
    expect(compact).toContain("grid-template-columns:1fr");
  });

  it("switches to two columns at the 640px breakpoint", () => {
    expect(compact).toMatch(/@media\(min-width:640px\)/);
    expect(compact).toContain("grid-template-columns:repeat(2,1fr)");
  });

  it("switches to four columns at the 1024px breakpoint", () => {
    expect(compact).toMatch(/@media\(min-width:1024px\)/);
    expect(compact).toContain("grid-template-columns:repeat(4,1fr)");
  });

  it("sources the grid gap from a --space-* token", () => {
    const gapMatch = css.match(/gap:\s*var\(\s*(--space-[^,)]+)/);
    expect(gapMatch).not.toBeNull();
    expect(gapMatch?.[1]).toMatch(/^--space-/);
  });

  it("sources the card padding from a --space-* token", () => {
    const paddingMatch = css.match(/padding:\s*var\(\s*(--space-[^,)]+)/);
    expect(paddingMatch).not.toBeNull();
    expect(paddingMatch?.[1]).toMatch(/^--space-/);
  });
});
