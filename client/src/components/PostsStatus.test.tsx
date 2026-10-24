import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PostsStatus, { POSTS_USAGE_NOTICE } from "./PostsStatus";
import TweetsPage from "../pages/TweetsPage";
import { SettingsProvider } from "../context/SettingsContext";
import { FollowProvider } from "../context/FollowContext";
import type { PostsSource, Tweet, TweetsResponse } from "../types/domain";

/**
 * Task 14.4 — the usage/attribution ToS notice (Req 11.6) must render wherever
 * live post content is shown in the Tweets view. We assert it both from the
 * `PostsStatus` component directly (for every origin the posts envelope can
 * report) and end-to-end through `TweetsPage` with a mocked Data_API envelope.
 */

function samplePost(overrides: Partial<Tweet> = {}): Tweet {
  return {
    id: "post-1",
    candidateId: "maura-healey",
    authorName: "Maura Healey",
    authorHandle: "maura_healey",
    text: "Fighting for affordable housing across the Commonwealth.",
    date: "2024-09-01T12:00:00.000Z",
    likes: 12,
    reposts: 3,
    tabs: ["recent"],
    sourceUrl: "https://example.com/posts/post-1",
    ...overrides,
  };
}

function tweetsResponse(source: PostsSource): TweetsResponse {
  return { posts: [samplePost()], source };
}

describe("PostsStatus ToS/usage notice (Req 11.6)", () => {
  beforeEach(() => {
    // /api/tweets/status is read to surface whether live posting is configured.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ livePostsEnabled: false }),
      })) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes the usage notice as a non-empty constant", () => {
    expect(POSTS_USAGE_NOTICE.trim().length).toBeGreaterThan(0);
  });

  it.each<PostsSource>(["live", "cache", "fallback"])(
    "renders the usage/attribution notice for the %s origin",
    async (source) => {
      render(<PostsStatus source={source} />);
      expect(await screen.findByText(POSTS_USAGE_NOTICE)).toBeInTheDocument();
    }
  );
});

describe("Tweets view renders the ToS/usage notice where posts are shown", () => {
  function renderTweetsPage(response: TweetsResponse) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes("/api/tweets/status")
          ? { livePostsEnabled: response.source === "live" }
          : response;
        return { ok: true, status: 200, json: async () => body };
      }) as unknown as typeof fetch
    );

    return render(
      <MemoryRouter initialEntries={["/tweets"]}>
        <SettingsProvider>
          <FollowProvider>
            <TweetsPage />
          </FollowProvider>
        </SettingsProvider>
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<PostsSource>(["live", "cache", "fallback"])(
    "shows the notice alongside live post content (%s origin)",
    async (source) => {
      renderTweetsPage(tweetsResponse(source));

      // The post content renders...
      expect(
        await screen.findByText(/affordable housing/i)
      ).toBeInTheDocument();
      // ...and the required usage/attribution notice renders with it.
      await waitFor(() =>
        expect(screen.getByText(POSTS_USAGE_NOTICE)).toBeInTheDocument()
      );
    }
  );
});
