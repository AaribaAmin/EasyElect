import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { filterByTab } from "./tweetFilter";
import type { Tweet, TweetTab } from "../types/domain";

/**
 * Property 16: Tab membership is preserved under filtering.
 *
 * For any served post and any tab `T` contained in that post's `tabs`,
 * filtering the served posts by `T` includes that post; tab filtering never
 * adds a post to a tab it was not assigned to nor drops a post from a tab it
 * was assigned to.
 *
 * **Validates: Requirements 7.6**
 */

/** The complete, closed set of tab values. */
const ALL_TABS: TweetTab[] = [
  "recent",
  "notable",
  "needsContext",
  "interactions",
];

const tabArb: fc.Arbitrary<TweetTab> = fc.constantFrom(...ALL_TABS);

/** A post's tab assignment: a (possibly empty) subset of the four tabs. */
const tabsArb: fc.Arbitrary<TweetTab[]> = fc.subarray(ALL_TABS);

/** An array of posts with distinct ids so each can be tracked individually. */
const postsArb: fc.Arbitrary<Tweet[]> = fc
  .array(tabsArb, { minLength: 0, maxLength: 12 })
  .chain((tabsList) =>
    fc.tuple(
      ...tabsList.map((tabs, i) =>
        fc.constant({
          id: `p${i}`,
          candidateId: `c${i}`,
          authorName: "Author",
          authorHandle: "@author",
          text: "post text",
          date: "2024-01-01",
          likes: 0,
          reposts: 0,
          tabs,
        } as Tweet)
      )
    )
  )
  .map((posts) => posts as Tweet[]);

describe("filterByTab — Property 16 (tab membership preserved under filtering)", () => {
  it("includes exactly the posts assigned to the tab (partition by membership)", () => {
    fc.assert(
      fc.property(postsArb, tabArb, (posts, tab) => {
        const filtered = filterByTab(posts, tab);
        const filteredIds = new Set(filtered.map((p) => p.id));

        for (const post of posts) {
          const assigned = post.tabs.includes(tab);
          // Never drops an assigned post; never adds an unassigned one.
          expect(filteredIds.has(post.id)).toBe(assigned);
        }
        // Every result is genuinely a member of the tab.
        for (const post of filtered) {
          expect(post.tabs.includes(tab)).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("includes a post under every tab it is assigned to", () => {
    fc.assert(
      fc.property(postsArb, (posts) => {
        for (const post of posts) {
          for (const tab of post.tabs) {
            const filtered = filterByTab(posts, tab);
            expect(filtered.some((p) => p.id === post.id)).toBe(true);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it("preserves input order and count equals the sum over tabs", () => {
    fc.assert(
      fc.property(postsArb, (posts) => {
        let total = 0;
        for (const tab of ALL_TABS) {
          const filtered = filterByTab(posts, tab);
          total += filtered.length;
          // Order within a tab matches the original order of included posts.
          const expectedOrder = posts
            .filter((p) => p.tabs.includes(tab))
            .map((p) => p.id);
          expect(filtered.map((p) => p.id)).toEqual(expectedOrder);
        }
        // Each post is counted once per tab it belongs to.
        const expectedTotal = posts.reduce((n, p) => n + p.tabs.length, 0);
        expect(total).toBe(expectedTotal);
      }),
      { numRuns: 200 }
    );
  });

  it("never mutates the input posts or their tabs", () => {
    fc.assert(
      fc.property(postsArb, tabArb, (posts, tab) => {
        const snapshot = posts.map((p) => ({ id: p.id, tabs: [...p.tabs] }));
        filterByTab(posts, tab);
        posts.forEach((p, i) => {
          expect(p.id).toBe(snapshot[i].id);
          expect(p.tabs).toEqual(snapshot[i].tabs);
        });
      }),
      { numRuns: 200 }
    );
  });
});
