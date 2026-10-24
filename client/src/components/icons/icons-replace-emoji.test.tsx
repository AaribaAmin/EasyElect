import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import HomePage from "../../pages/HomePage";
import PageHeader from "../PageHeader";
import Layout from "../Layout";
import SettingsToggles from "../SettingsToggles";
import Chatbot from "../chatbot/Chatbot";
import TweetCard from "../../features/tweets/TweetCard";
import { SettingsProvider } from "../../context/SettingsContext";
import { FollowProvider } from "../../context/FollowContext";
import { CausesProvider } from "../../context/CausesContext";
import type { Tweet } from "../../types/domain";

/**
 * Icons-replace-emoji cross-cutting tests (Task 10.1).
 *
 * Every user-facing surface that previously rendered an emoji now renders an
 * inline SVG icon instead. These tests assert, at each surface, that:
 *   1. an `<svg>` element is present (the vector icon rendered), and
 *   2. none of the previously-used emoji codepoints survive in the DOM text.
 *
 * They also assert the icon styling contract at the source level: the shared
 * `Icon.module.css` sets `color: inherit` (so the glyph inherits its surface's
 * token-driven color) and every glyph draws with `currentColor` (no hardcoded
 * color literal), per Req 4.10.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.10**
 */

/** The emoji codepoints that icons replaced across the app (Req 4.1–4.6). */
const RETIRED_EMOJI = [
  "\u{1F5F3}\uFE0F", // 🗳️ ballot box (voting / brand)
  "\u{1F4AC}", // 💬 speech balloon (tweets / chat)
  "\u{1F3AF}", // 🎯 direct hit (causes)
  "\u{1F91D}", // 🤝 handshake (connect)
  "\u{1F319}", // 🌙 crescent moon (dark theme)
  "\u2600\uFE0F", // ☀️ sun (light theme)
  "\u2665", // ♥ heart (like)
  "\u{1F501}", // 🔁 repeat (repost)
  "\u2139\uFE0F", // ℹ️ information (added context)
] as const;

/** Bare codepoints too, so a stripped variation selector can't sneak through. */
const RETIRED_EMOJI_CHARS = [
  "\u{1F5F3}",
  "\u{1F4AC}",
  "\u{1F3AF}",
  "\u{1F91D}",
  "\u{1F319}",
  "\u2600",
  "\u2665",
  "\u{1F501}",
  "\u2139",
] as const;

function assertNoRetiredEmoji(text: string): void {
  for (const emoji of [...RETIRED_EMOJI, ...RETIRED_EMOJI_CHARS]) {
    expect(text).not.toContain(emoji);
  }
}

/** Wrap a surface in the app-level providers (mirrors App.test.tsx). */
function withProviders(ui: React.ReactNode, initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SettingsProvider>
        <FollowProvider>
          <CausesProvider>{ui}</CausesProvider>
        </FollowProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

const SAMPLE_TWEET: Tweet = {
  id: "t1",
  candidateId: "c1",
  authorName: "Jane Candidate",
  authorHandle: "@janecandidate",
  text: "Investing in public transit for every Massachusetts community.",
  date: "2025-01-15T12:00:00.000Z",
  likes: 1234,
  reposts: 56,
  tabs: ["recent"],
  context: { simple: "Context in plain terms.", expert: "Context in detail." },
  sourceUrl: "https://example.com/post/t1",
};

beforeEach(() => {
  // Route-aware fetch stub (mirrors App.test.tsx): health/ai-status objects,
  // everything else an empty list. Keeps data-fetching surfaces from throwing.
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
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch
  );
  window.localStorage.clear();
});

describe("icons replace emoji across surfaces (Req 4.1–4.6)", () => {
  it("renders an <svg> on the Home page and no retired emoji", () => {
    const { container } = withProviders(<HomePage />, "/");
    expect(container.querySelector("svg")).not.toBeNull();
    assertNoRetiredEmoji(container.textContent ?? "");
  });

  it("renders an <svg> in a PageHeader and no retired emoji", () => {
    const { container } = withProviders(
      <PageHeader icon="voting" title="Voting" subtitle="How voting works" />
    );
    expect(container.querySelector("svg")).not.toBeNull();
    assertNoRetiredEmoji(container.textContent ?? "");
  });

  it("renders an <svg> brand mark in the Layout and no retired emoji", () => {
    const { container } = withProviders(
      <Layout>
        <p>content</p>
      </Layout>
    );
    expect(container.querySelector("svg")).not.toBeNull();
    assertNoRetiredEmoji(container.textContent ?? "");
  });

  it("renders an <svg> theme indicator in SettingsToggles and no retired emoji", () => {
    const { container } = withProviders(<SettingsToggles />);
    expect(container.querySelector("svg")).not.toBeNull();
    assertNoRetiredEmoji(container.textContent ?? "");
  });

  it("renders an <svg> launcher glyph in the Chatbot and no retired emoji", () => {
    const { container } = withProviders(<Chatbot />);
    expect(container.querySelector("svg")).not.toBeNull();
    assertNoRetiredEmoji(container.textContent ?? "");
  });

  it("renders <svg> markers in a TweetCard (with context) and no retired emoji", () => {
    const { container } = withProviders(
      <TweetCard tweet={SAMPLE_TWEET} showContext />
    );
    // like, repost, and the added-context info marker are all vector icons.
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
    assertNoRetiredEmoji(container.textContent ?? "");
  });
});

describe("icon styling contract (Req 4.10)", () => {
  // Vitest runs from the client/ package root, so resolve the icon source
  // files relative to the working directory (jsdom's import.meta.url is not a
  // file: URL, so URL-based resolution is not available here).
  const ICONS_DIR = resolve(process.cwd(), "src/components/icons");

  it("Icon.module.css sets color: inherit on the icon", () => {
    const css = readFileSync(resolve(ICONS_DIR, "Icon.module.css"), "utf8");
    // The .icon rule inherits its color from the surrounding surface.
    const iconRule = css.slice(css.indexOf(".icon"));
    expect(iconRule).toMatch(/color:\s*inherit/);
  });

  it("glyphs draw with currentColor and contain no hex color literal", () => {
    const glyphs = readFileSync(resolve(ICONS_DIR, "glyphs.tsx"), "utf8");
    expect(glyphs).toContain("currentColor");
    // No hardcoded color literals: hex, rgb()/rgba(), or hsl()/hsla().
    expect(glyphs).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(glyphs).not.toMatch(/\brgba?\(/);
    expect(glyphs).not.toMatch(/\bhsla?\(/);
  });
});
