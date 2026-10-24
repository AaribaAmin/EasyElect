import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fc from "fast-check";
import TweetsPage from "./TweetsPage";
import { POSTS_USAGE_NOTICE } from "../components/PostsStatus";
import { filterByTab } from "../lib/tweetFilter";
import { orderByFollowed } from "../lib/feedFilter";
import { writeStorage } from "../lib/storage";
import { SettingsProvider } from "../context/SettingsContext";
import { FollowProvider } from "../context/FollowContext";
import type {
  News_Item,
  PostsSource,
  TweetTab,
  TweetsResponse,
} from "../types/domain";

/**
 * Property 2 (Preservation) and Property 3 (Interactions tab consistency) for
 * the News section.
 *
 * These preservation tests encode the behavior of the repurposed Tweets/News
 * view that must hold across generated `News_Item` envelopes and follow sets.
 * The item model moved from the x.com-`Tweet` shape to `News_Item`
 * (`candidateIds[]` any-of matching, headline/outlet/url/date, no
 * handle/likes/reposts), so the handle-based exploration and the
 * likes/reposts assertions of the prior test are retired; what is preserved
 * and pinned here is:
 *
 *   Property 2 (Preservation) — tab membership via `filterByTab`, followed-first
 *     ordering (any-of over `candidateIds`, most-recent-first by `date` within
 *     each group, matching `orderByFollowed`), the neutral "Added context"
 *     block on the Needs Context tab, and the Live / Cached / Fallback origin
 *     indicator plus the usage/attribution notice (Req 2.6, 3.2, 3.4).
 *   Property 3 (Interactions consistency) — an item appears on the Interactions
 *     tab iff `"interactions"` is in its `tabs`, and items placed on the
 *     Interactions tab carry `candidateIds.length >= 2` (the server's
 *     multi-candidate invariant) (Req 3.3).
 *
 * The page's real `orderByFollowed` is reused as the ordering oracle so the
 * rendered DOM order is pinned to the shipped behavior, not a private copy.
 *
 * Validates: Requirements 2.6, 3.2, 3.3, 3.4
 */

const ORIGIN_LABEL: Record<PostsSource, string> = {
  live: "Live",
  cache: "Cached",
  fallback: "Fallback",
};

const TAB_LABEL: Record<TweetTab, string> = {
  recent: "Recent News",
  notable: "Notable News",
  needsContext: "Needs Context",
  interactions: "Interactions",
};

const ALL_TABS: TweetTab[] = ["recent", "notable", "needsContext", "interactions"];

/**
 * Full expected displayed order for a tab (following-only OFF): filter by tab
 * membership, then order followed-first + most-recent-first using the page's
 * own `orderByFollowed` so the oracle cannot drift from the implementation.
 */
function expectedOrder(
  posts: News_Item[],
  tab: TweetTab,
  following: string[],
): News_Item[] {
  return orderByFollowed(filterByTab(posts, tab), new Set(following));
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
        : url.includes("/api/candidates")
          ? []
          : response;
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch,
  );

  return render(
    <MemoryRouter initialEntries={["/tweets"]}>
      <SettingsProvider>
        <FollowProvider>
          <TweetsPage />
        </FollowProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

const CANDIDATE_POOL = ["cand-a", "cand-b", "cand-c", "cand-d"] as const;

/**
 * Generator for a set of displayed News items with distinct ids and titles.
 * Each item draws a non-empty subset of candidateIds from a small pool (so a
 * follow set can select a meaningful any-of subset) and a non-empty subset of
 * tabs (so every item lands in at least one tab), carries a distinct ISO date
 * (so most-recent-first ordering is exercised), and carries a `context` block
 * so "Added context" can render on the needsContext tab.
 *
 * Property 3 invariant: any item tagged with the `"interactions"` tab is given
 * at least two candidateIds, matching the server's multi-candidate guarantee.
 */
const postsArb: fc.Arbitrary<News_Item[]> = fc
  .array(
    fc.record({
      candidateIds: fc
        .subarray([...CANDIDATE_POOL], { minLength: 1 })
        .map((ids) => ids as string[]),
      tabs: fc.subarray(ALL_TABS, { minLength: 1 }).map((t) => t as TweetTab[]),
    }),
    { minLength: 1, maxLength: 10 },
  )
  .map((specs) =>
    specs.map((spec, i): News_Item => {
      const tabs = spec.tabs;
      // Property 3 / server invariant: interactions items are multi-candidate.
      const candidateIds = tabs.includes("interactions")
        ? Array.from(new Set([...spec.candidateIds, "cand-a", "cand-b"])).slice(
            0,
            Math.max(2, spec.candidateIds.length),
          )
        : spec.candidateIds;
      return {
        id: `news-${i}`,
        candidateIds:
          candidateIds.length >= 2 || !tabs.includes("interactions")
            ? candidateIds
            : [...candidateIds, "cand-b"],
        // Distinct, human-readable identity used to assert rendered order.
        title: `News headline number ${i}`,
        outlet: `Outlet ${i}`,
        url: `https://example.com/article/${i}`,
        // Distinct descending-ish timestamps so date ordering is meaningful.
        date: new Date(2026, 0, 1 + i).toISOString(),
        tabs,
        context: {
          simple: `simple context ${i}`,
          expert: `expert context ${i}`,
        },
      };
    }),
  );

/** A follow set: any subset of the candidate pool (including empty). */
const followingArb: fc.Arbitrary<string[]> = fc.subarray([...CANDIDATE_POOL]);

/** Pull the rendered item order by their stable headline text. */
function renderedOrder(): string[] {
  const titles = screen.queryAllByText(/^News headline number \d+$/);
  return titles.map((el) => el.textContent ?? "");
}

describe("Property 2 (preservation): tabs, ordering, and context (Req 2.6, 3.2, 3.4)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("renders the recent tab's items followed-first, most-recent-first within group", async () => {
    await fc.assert(
      fc.asyncProperty(postsArb, followingArb, async (posts, following) => {
        // Default tab on mount is "recent".
        const { unmount } = renderTweetsPage({ posts, source: "live" }, following);

        const expected = expectedOrder(posts, "recent", following);
        const expectedTitles = expected.map((p) => p.title);

        try {
          await waitFor(() => {
            expect(renderedOrder()).toHaveLength(expectedTitles.length);
          });
          expect(renderedOrder()).toEqual(expectedTitles);
        } finally {
          unmount();
        }
      }),
      { numRuns: 40 },
    );
  });

  it("shows an 'Added context' block per displayed item on the Needs Context tab", async () => {
    await fc.assert(
      fc.asyncProperty(postsArb, followingArb, async (posts, following) => {
        const user = (await import("@testing-library/user-event")).default.setup();
        const { unmount } = renderTweetsPage({ posts, source: "cache" }, following);

        const expected = expectedOrder(posts, "needsContext", following);

        try {
          const tab = await screen.findByRole("tab", {
            name: TAB_LABEL.needsContext,
          });
          await user.click(tab);

          await waitFor(() => {
            const labels = screen.queryAllByText("Added context");
            expect(labels).toHaveLength(expected.length);
          });

          expect(renderedOrder()).toEqual(expected.map((p) => p.title));
        } finally {
          unmount();
        }
      }),
      { numRuns: 25 },
    );
  });

  it("partitions each of the four tabs by membership (count + order parity)", async () => {
    await fc.assert(
      fc.asyncProperty(
        postsArb,
        followingArb,
        fc.constantFrom(...ALL_TABS),
        async (posts, following, tab) => {
          const user = (await import("@testing-library/user-event")).default.setup();
          const { unmount } = renderTweetsPage(
            { posts, source: "fallback" },
            following,
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
            expect(renderedOrder()).toEqual(expected.map((p) => p.title));
          } finally {
            unmount();
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});

describe("Property 3 (interactions tab consistency) (Req 3.3)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("shows an item on Interactions iff 'interactions' ∈ tabs, and those items are multi-candidate", async () => {
    await fc.assert(
      fc.asyncProperty(postsArb, followingArb, async (posts, following) => {
        const user = (await import("@testing-library/user-event")).default.setup();
        const { unmount } = renderTweetsPage(
          { posts, source: "fallback" },
          following,
        );

        // The items that belong on the Interactions tab, in page order.
        const expected = expectedOrder(posts, "interactions", following);

        // Dataset/UI invariant: every item on the interactions tab carries at
        // least two candidateIds (matches the server's multi-candidate rule).
        for (const item of expected) {
          expect(item.candidateIds.length).toBeGreaterThanOrEqual(2);
        }
        // Tab membership is exactly "interactions" ∈ tabs.
        const byMembership = posts.filter((p) => p.tabs.includes("interactions"));
        expect(expected.map((p) => p.id).sort()).toEqual(
          byMembership.map((p) => p.id).sort(),
        );

        try {
          const tabButton = await screen.findByRole("tab", {
            name: TAB_LABEL.interactions,
          });
          await user.click(tabButton);

          await waitFor(() => {
            expect(renderedOrder()).toHaveLength(expected.length);
          });
          expect(renderedOrder()).toEqual(expected.map((p) => p.title));
        } finally {
          unmount();
        }
      }),
      { numRuns: 30 },
    );
  });
});

describe("Property 2 (preservation): origin indicator and usage notice (Req 3.2)", () => {
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
            // The usage/attribution notice is unique to PostsStatus and only
            // appears once the feed has loaded.
            await waitFor(() =>
              expect(screen.getByText(POSTS_USAGE_NOTICE)).toBeInTheDocument(),
            );

            const statuses = screen.getAllByRole("status");
            const hasOrigin = statuses.some((el) =>
              (el.textContent ?? "").includes(ORIGIN_LABEL[source]),
            );
            expect(hasOrigin).toBe(true);
          } finally {
            unmount();
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
