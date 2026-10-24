import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fc from "fast-check";
import TweetsPage from "./TweetsPage";
import { POSTS_USAGE_NOTICE } from "../components/PostsStatus";
import { filterByTab } from "../lib/tweetFilter";
import { writeStorage } from "../lib/storage";
import { SettingsProvider } from "../context/SettingsContext";
import { FollowProvider } from "../context/FollowContext";
import type { PostsSource, Tweet, TweetTab, TweetsResponse } from "../types/domain";

/**
 * Property 2 (Preservation): Tweets view behavior unchanged.
 *
 * OBSERVATION-FIRST PRESERVATION TESTS — these encode the baseline rendering
 * behavior of the Tweets view that the genuine-x-posts fix must NOT change.
 * They are written and run against the UNFIXED code first; every assertion
 * captures behavior observed on the current page. The fix only changes the
 * back-link host and empties the fallback dataset, so none of the following is
 * affected and these must still pass afterward:
 *
 *   (c) Tabs / ordering / context — for a generated set of displayed posts and
 *       a follow set, the four tabs partition by tab membership (filterByTab),
 *       followed candidates are ordered first (orderByFollowed, stable within),
 *       and "Added context" blocks render for the displayed posts on the
 *       "Needs Context" tab (Req 3.2).
 *   (d) Origin indicator & notice — the Live / Cached / Fallback indicator and
 *       the usage/attribution notice render on views showing live content
 *       (Req 3.3).
 *
 * The page's own `orderByFollowed` is defined inside `TweetsPage`; here we
 * reproduce its stable "followed first" contract as a reference oracle and
 * assert the rendered DOM order matches it, so the behavior — not a private
 * helper — is pinned.
 *
 * Validates: Requirements 3.2, 3.3
 */

const ORIGIN_LABEL: Record<PostsSource, string> = {
  live: "Live",
  cache: "Cached",
  fallback: "Fallback",
};

const TAB_LABEL: Record<TweetTab, string> = {
  recent: "Recent Posts",
  notable: "Notable Posts",
  needsContext: "Needs Context",
  interactions: "Interactions",
};

const ALL_TABS: TweetTab[] = ["recent", "notable", "needsContext", "interactions"];

/**
 * Reference oracle for the page's ordering: when the user follows nobody the
 * list is unchanged; otherwise followed candidates float to the front with a
 * STABLE sort (original order preserved within each group). This mirrors
 * `orderByFollowed` in TweetsPage.tsx.
 */
function orderByFollowedOracle(list: Tweet[], following: string[]): Tweet[] {
  if (following.length === 0) return list;
  const followingSet = new Set(following);
  return [...list].sort((a, b) => {
    const af = followingSet.has(a.candidateId) ? 0 : 1;
    const bf = followingSet.has(b.candidateId) ? 0 : 1;
    return af - bf;
  });
}

/** Full expected displayed order for a tab: filter by membership, then order. */
function expectedOrder(
  posts: Tweet[],
  tab: TweetTab,
  following: string[]
): Tweet[] {
  return orderByFollowedOracle(filterByTab(posts, tab), following);
}

/** Render TweetsPage with a stubbed Data_API envelope and a seeded follow set. */
function renderTweetsPage(response: TweetsResponse, following: string[]) {
  // The follow set lives under the "easyelect:" namespace via writeStorage, so
  // FollowProvider reads it back on mount (mirrors how the app persists it).
  writeStorage("follows", following);

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

/**
 * Generator for a set of displayed posts with distinct ids, drawn from a small
 * pool of candidate ids (so a follow set can select a meaningful subset), each
 * assigned a non-empty subset of tabs so every post lands in at least one tab.
 * Each post carries a `context` block so "Added context" can render on the
 * needsContext tab.
 */
const CANDIDATE_POOL = ["cand-a", "cand-b", "cand-c", "cand-d"] as const;

const postsArb: fc.Arbitrary<Tweet[]> = fc
  .array(
    fc.record({
      candidateId: fc.constantFrom(...CANDIDATE_POOL),
      // Non-empty subset of tabs: a post always appears in at least one tab.
      tabs: fc
        .subarray(ALL_TABS, { minLength: 1 })
        .map((t) => t as TweetTab[]),
    }),
    { minLength: 1, maxLength: 10 }
  )
  .map((specs) =>
    specs.map(
      (spec, i): Tweet => ({
        id: `post-${i}`,
        candidateId: spec.candidateId,
        authorName: `Author ${i}`,
        authorHandle: `@author_${i}`,
        text: `Post body number ${i}`,
        date: "2026-01-01T00:00:00.000Z",
        likes: i,
        reposts: i,
        tabs: spec.tabs,
        context: {
          simple: `simple context ${i}`,
          expert: `expert context ${i}`,
        },
      })
    )
  );

/** A follow set: any subset of the candidate pool (including empty). */
const followingArb: fc.Arbitrary<string[]> = fc.subarray([...CANDIDATE_POOL]);

/** Pull the rendered post order (by stable test id derived from author line). */
function renderedOrder(): string[] {
  // Each TweetCard renders its body text "Post body number N"; the DOM order of
  // those paragraphs is the displayed order.
  const bodies = screen.queryAllByText(/^Post body number \d+$/);
  return bodies.map((el) => el.textContent ?? "");
}

describe("Property 2 (preservation): tabs, ordering, and context (Req 3.2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("renders the recent tab's posts in the followed-first partition order", async () => {
    await fc.assert(
      fc.asyncProperty(postsArb, followingArb, async (posts, following) => {
        // Default tab on mount is "recent".
        const { unmount } = renderTweetsPage({ posts, source: "live" }, following);

        const expected = expectedOrder(posts, "recent", following);
        const expectedBodies = expected.map((p) => p.text);

        try {
          // Wait until the feed has settled to the expected number of cards.
          await waitFor(() => {
            expect(renderedOrder()).toHaveLength(expectedBodies.length);
          });
          // The displayed order matches filter-by-membership then followed-first.
          expect(renderedOrder()).toEqual(expectedBodies);
        } finally {
          unmount();
        }
      }),
      { numRuns: 40 }
    );
  });

  it("shows an 'Added context' block per displayed post on the Needs Context tab", async () => {
    await fc.assert(
      fc.asyncProperty(postsArb, followingArb, async (posts, following) => {
        const user = (await import("@testing-library/user-event")).default.setup();
        const { unmount } = renderTweetsPage({ posts, source: "cache" }, following);

        const expected = expectedOrder(posts, "needsContext", following);

        try {
          // Switch to the Needs Context tab.
          const tab = await screen.findByRole("tab", {
            name: TAB_LABEL.needsContext,
          });
          await user.click(tab);

          await waitFor(() => {
            const labels = screen.queryAllByText("Added context");
            expect(labels).toHaveLength(expected.length);
          });

          // The same posts that belong to the tab are the ones displayed.
          const bodies = renderedOrder();
          expect(bodies).toEqual(expected.map((p) => p.text));
        } finally {
          unmount();
        }
      }),
      { numRuns: 25 }
    );
  });

  it("partitions each of the four tabs by membership (count parity)", async () => {
    await fc.assert(
      fc.asyncProperty(
        postsArb,
        followingArb,
        fc.constantFrom(...ALL_TABS),
        async (posts, following, tab) => {
          const user = (await import("@testing-library/user-event")).default.setup();
          const { unmount } = renderTweetsPage(
            { posts, source: "fallback" },
            following
          );

          const expected = expectedOrder(posts, tab, following);

          try {
            const tabButton = await screen.findByRole("tab", {
              name: TAB_LABEL[tab],
            });
            await user.click(tabButton);

            await waitFor(() => {
              expect(renderedOrder()).toHaveLength(expected.length);
            });
            expect(renderedOrder()).toEqual(expected.map((p) => p.text));
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe("Property 2 (preservation): origin indicator and usage notice (Req 3.3)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("shows the origin indicator and attribution notice for every origin", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<PostsSource>("live", "cache", "fallback"),
        postsArb,
        async (source, posts) => {
          const { unmount } = renderTweetsPage({ posts, source }, []);

          try {
            // Wait for live content to render: the usage/attribution notice is
            // unique to PostsStatus and only appears once the feed has loaded
            // (before that, AsyncContent shows a "Loading…" status placeholder).
            await waitFor(() =>
              expect(screen.getByText(POSTS_USAGE_NOTICE)).toBeInTheDocument()
            );

            // The origin indicator carries the Live/Cached/Fallback label. Once
            // loaded, the only remaining role="status" element is the badge.
            const statuses = screen.getAllByRole("status");
            const hasOrigin = statuses.some((el) =>
              (el.textContent ?? "").includes(ORIGIN_LABEL[source])
            );
            expect(hasOrigin).toBe(true);
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
