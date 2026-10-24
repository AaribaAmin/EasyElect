import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { SettingsProvider } from "./context/SettingsContext";
import { FollowProvider } from "./context/FollowContext";
import { CausesProvider } from "./context/CausesContext";

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
});

describe("App shell", () => {
  it("renders the home page with four section cards", () => {
    renderApp("/");
    expect(
      screen.getByRole("heading", { name: /easy to understand/i })
    ).toBeInTheDocument();
    const sectionNav = screen.getByRole("navigation", { name: /sections/i });
    expect(sectionNav).toBeInTheDocument();
  });

  it("shows the persistent chatbot on every page", () => {
    renderApp("/connect");
    expect(
      screen.getByRole("region", { name: /ask easy elect/i })
    ).toBeInTheDocument();
  });

  it("navigates between sections via the primary nav", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: "Causes" }));
    expect(
      screen.getByRole("heading", { name: "Causes", level: 1 })
    ).toBeInTheDocument();
  });
});
