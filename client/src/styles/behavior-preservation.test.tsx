import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import FollowButton from "../features/voting/FollowButton";
import { SettingsProvider } from "../context/SettingsContext";
import { FollowProvider } from "../context/FollowContext";
import { CausesProvider } from "../context/CausesContext";

/**
 * Task 10.5 — behavior-preservation tests (Requirements 9.1, 9.2).
 *
 * The minimalist redesign is presentation-only: no route, data flow, or
 * interactive behavior should change. These tests assert every route still
 * renders its page (Req 9.1) and that the theme toggle, detail-mode toggle,
 * chatbot submit, and FollowButton still perform their actions (Req 9.2).
 *
 * The render harness mirrors App.test.tsx exactly (MemoryRouter +
 * SettingsProvider + FollowProvider + CausesProvider wrapping App), with a
 * route-aware fetch stub so data pages don't throw.
 */
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

// Records POSTed chat payloads so we can assert the chatbot reached /api/chat.
const chatCalls: { url: string; body: unknown }[] = [];

beforeEach(() => {
  chatCalls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = (() => {
        if (url.includes("/api/health"))
          return { status: "ok", service: "test" };
        if (url.includes("/api/ai/status")) return { aiEnabled: false };
        if (url.includes("/api/chat")) {
          chatCalls.push({
            url,
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
          });
          return { reply: "ok", detectedCauses: [], source: "scripted" };
        }
        // All data list endpoints return empty arrays for the shell tests.
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
  document.documentElement.removeAttribute("data-theme");
});

describe("Behavior preservation — route rendering (Req 9.1)", () => {
  it("renders the home page at /", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: /easy to understand/i })
    ).toBeInTheDocument();
  });

  it("renders the voting page at /voting", async () => {
    renderApp("/voting");
    expect(
      await screen.findByRole("heading", { name: "Voting", level: 1 })
    ).toBeInTheDocument();
  });

  it("renders the tweets page at /tweets", async () => {
    renderApp("/tweets");
    expect(
      await screen.findByRole("heading", { name: "Tweets", level: 1 })
    ).toBeInTheDocument();
  });

  it("renders the causes page at /causes", async () => {
    renderApp("/causes");
    expect(
      await screen.findByRole("heading", { name: "Causes", level: 1 })
    ).toBeInTheDocument();
  });

  it("renders the connect page at /connect", async () => {
    renderApp("/connect");
    expect(
      await screen.findByRole("heading", { name: "Connect", level: 1 })
    ).toBeInTheDocument();
  });

  it("renders the Not Found page for an unknown path", async () => {
    renderApp("/nope");
    expect(
      await screen.findByRole("heading", { name: /page not found/i, level: 1 })
    ).toBeInTheDocument();
  });
});

describe("Behavior preservation — interactive controls (Req 9.2)", () => {
  it("theme toggle flips the document data-theme attribute", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const themeBtn = await screen.findByRole("button", {
      name: /switch to .* mode/i,
    });
    const before = document.documentElement.getAttribute("data-theme");

    await user.click(themeBtn);
    const after = document.documentElement.getAttribute("data-theme");

    expect(after).not.toBe(before);
    expect(after === "light" || after === "dark").toBe(true);
  });

  it("detail-mode toggle updates aria-pressed on the Simple/Expert buttons", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const group = await screen.findByRole("group", { name: /detail level/i });
    const simple = within(group).getByRole("button", { name: "Simple" });
    const expert = within(group).getByRole("button", { name: "Expert" });

    // Default mode is "simple".
    expect(simple).toHaveAttribute("aria-pressed", "true");
    expect(expert).toHaveAttribute("aria-pressed", "false");

    await user.click(expert);
    expect(expert).toHaveAttribute("aria-pressed", "true");
    expect(simple).toHaveAttribute("aria-pressed", "false");

    await user.click(simple);
    expect(simple).toHaveAttribute("aria-pressed", "true");
    expect(expert).toHaveAttribute("aria-pressed", "false");
  });

  it("chatbot submit shows the user message and posts to /api/chat", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const input = await screen.findByPlaceholderText(/ask easy elect/i);
    await user.type(input, "What is ranked choice voting?");
    await user.keyboard("{Enter}");

    // The typed message appears in the chat log.
    expect(
      await screen.findByText("What is ranked choice voting?")
    ).toBeInTheDocument();

    // A fetch to /api/chat was attempted with the typed message.
    expect(chatCalls.length).toBeGreaterThan(0);
    expect(chatCalls[0].url).toContain("/api/chat");
    expect(chatCalls[0].body).toMatchObject({
      message: "What is ranked choice voting?",
    });

    // The scripted reply is rendered too.
    expect(await screen.findByText("ok")).toBeInTheDocument();
  });

  it("FollowButton toggles follow state and label when clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FollowProvider>
          <FollowButton candidateId="cand-1" />
        </FollowProvider>
      </MemoryRouter>
    );

    const btn = screen.getByRole("button");
    // Not following initially.
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent(/follow/i);
    expect(btn).not.toHaveTextContent(/following/i);

    await user.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveTextContent(/following/i);

    await user.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).not.toHaveTextContent(/following/i);
  });
});
