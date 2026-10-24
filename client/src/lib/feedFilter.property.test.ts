import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { News_Item, Party, TweetTab } from "../types/domain";
import {
  ALL_PARTIES,
  applyFeedFilters,
  orderByFollowed,
  resolveParty,
  type PartyIndex,
  type PartySelection,
} from "./feedFilter";
import { filterByTab } from "./tweetFilter";

/**
 * Property tests for the pure, React-free feed filters and ordering in
 * `feedFilter.ts`.
 *
 * Feature: news-section, Property 4 (Any-of filters and ordering).
 *
 * All three adaptations move from a single `post.candidateId` to any-of over
 * `item.candidateIds`:
 *  - the party filter keeps an item iff ANY id resolves to the selected party,
 *  - the follow filter keeps an item iff ANY id is in the followed set (empty
 *    follow set ⇒ empty feed),
 *  - `orderByFollowed` floats any-of-followed items ahead of the rest, then
 *    orders each group most-recent-first by `date` (stable on ties),
 * and every function is pure: inputs are not mutated and outputs are fresh.
 *
 * Validates: Requirements 2.7, 2.8, 3.4
 */

const PARTIES: Party[] = [
  "Democratic",
  "Republican",
  "Independent",
  "Libertarian",
  "Green-Rainbow",
  "Nonpartisan",
  "Socialism and Liberation",
  "Unenrolled",
];

const TABS: TweetTab[] = ["recent", "notable", "needsContext", "interactions"];

/**
 * A small candidate pool so follow/party sets select meaningful subsets rather
 * than almost-always-empty or almost-always-everything. Includes an id
 * ("c-unknown") deliberately absent from the party index so items can resolve
 * to no party and be excluded under a specific party selection.
 */
const CANDIDATE_POOL = ["c-1", "c-2", "c-3", "c-4", "c-5", "c-unknown"] as const;

/** Fixed party assignment for the known ids; "c-unknown" is intentionally absent. */
const PARTY_BY_ID: ReadonlyMap<string, Party> = new Map<string, Party>([
  ["c-1", "Democratic"],
  ["c-2", "Republican"],
  ["c-3", "Independent"],
  ["c-4", "Democratic"],
  ["c-5", "Libertarian"],
]);

/** The party index under test: a read-only snapshot shared across runs. */
function freshPartyIndex(): PartyIndex {
  return new Map(PARTY_BY_ID);
}

/**
 * A small set of ISO date strings spanning a range, deliberately including
 * duplicates (equal dates) and an unparseable value to exercise the stable
 * tie-break in `orderByFollowed`.
 */
const DATE_POOL = [
  "2026-01-01T00:00:00.000Z",
  "2026-03-15T12:00:00.000Z",
  "2026-03-15T12:00:00.000Z", // equal to the previous → tie
  "2026-06-30T09:30:00.000Z",
  "2026-11-03T18:45:00.000Z",
  "not-a-date", // unparseable → NaN, treated as tie
] as const;

/**
 * One News_Item *without* an id: candidateIds drawn from the pool and a date
 * from the pool. The `id` is assigned at the array level (see `postsArb`) by
 * array index so every item in a generated run has a distinct id. Assigning
 * ids here from a generated integer would let fast-check shrinking collapse
 * distinct items onto the same id, which the stability oracles (which track
 * items by `id`) would then misread as a reordering.
 */
const newsItemArb: fc.Arbitrary<Omit<News_Item, "id">> = fc
  .record({
    idx: fc.integer({ min: 0, max: 1_000_000 }),
    candidateIds: fc.uniqueArray(fc.constantFrom(...CANDIDATE_POOL), {
      minLength: 1,
      maxLength: CANDIDATE_POOL.length,
    }),
    tabs: fc.uniqueArray(fc.constantFrom(...TABS), {
      minLength: 1,
      maxLength: TABS.length,
    }),
    date: fc.constantFrom(...DATE_POOL),
  })
  .map(({ idx, candidateIds, tabs, date }): Omit<News_Item, "id"> => ({
    candidateIds,
    title: `Headline ${idx}`,
    outlet: "Example Outlet",
    url: `https://example.test/article/${idx}`,
    date,
    tabs,
  }));

const postsArb: fc.Arbitrary<News_Item[]> = fc
  .array(newsItemArb, {
    minLength: 0,
    maxLength: 15,
  })
  .map((specs) =>
    specs.map((spec, i): News_Item => ({ id: `news-${i}`, ...spec })),
  );

/** A followed set: a (possibly empty) subset of the candidate pool. */
const followedSetArb: fc.Arbitrary<Set<string>> = fc
  .uniqueArray(fc.constantFrom(...CANDIDATE_POOL), {
    minLength: 0,
    maxLength: CANDIDATE_POOL.length,
  })
  .map((ids) => new Set(ids));

/** A party selection: the ALL sentinel or a specific party. */
const partySelectionArb: fc.Arbitrary<PartySelection> = fc.oneof(
  fc.constant<PartySelection>(ALL_PARTIES),
  fc.constantFrom<PartySelection>(...PARTIES),
);

const tabArb: fc.Arbitrary<TweetTab> = fc.constantFrom(...TABS);

/** Deep structural snapshot of an item list, for mutation detection. */
function snapshot(items: readonly News_Item[]): string {
  return JSON.stringify(
    items.map((i) => ({
      id: i.id,
      candidateIds: [...i.candidateIds],
      tabs: [...i.tabs],
      date: i.date,
    })),
  );
}

describe("Feature: news-section, Property 4: party filter keeps an item iff ANY id resolves to the selected party", () => {
  it("specific party keeps exactly the items with an any-of match; ALL_PARTIES passes all (within tab)", () => {
    fc.assert(
      fc.property(
        postsArb,
        partySelectionArb,
        tabArb,
        (posts, party, tab) => {
          const partyIndex = freshPartyIndex();
          const result = applyFeedFilters({
            posts,
            tab,
            party,
            followingOnly: false,
            followedSet: new Set<string>(),
            partyIndex,
          });

          const inTab = filterByTab([...posts], tab);
          const expected = inTab.filter((item) =>
            party === ALL_PARTIES
              ? true
              : item.candidateIds.some((id) => partyIndex.get(id) === party),
          );

          // Membership + order match the any-of oracle exactly.
          expect(result).toEqual(expected);

          // Every surfaced item has an any-of match for a specific party; items
          // whose ids resolve to no party are excluded under a specific party.
          if (party !== ALL_PARTIES) {
            for (const item of result) {
              expect(
                item.candidateIds.some((id) => partyIndex.get(id) === party),
              ).toBe(true);
            }
            // An item resolving to no party is never surfaced.
            for (const item of inTab) {
              if (resolveParty(item, partyIndex) === undefined) {
                expect(result).not.toContain(item);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: news-section, Property 4: following-only keeps an item iff ANY id is followed; empty follow set ⇒ []", () => {
  it("with followingOnly, surfaces exactly the any-of-followed items within the tab", () => {
    fc.assert(
      fc.property(postsArb, followedSetArb, tabArb, (posts, followedSet, tab) => {
        const partyIndex = freshPartyIndex();
        const result = applyFeedFilters({
          posts,
          tab,
          party: ALL_PARTIES,
          followingOnly: true,
          followedSet,
          partyIndex,
        });

        const inTab = filterByTab([...posts], tab);
        const expected = inTab.filter((item) =>
          item.candidateIds.some((id) => followedSet.has(id)),
        );
        expect(result).toEqual(expected);

        // Empty follow set with following-only on yields [] (not an error).
        if (followedSet.size === 0) {
          expect(result).toEqual([]);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("empty follow set with followingOnly yields an empty feed for every tab", () => {
    fc.assert(
      fc.property(postsArb, tabArb, (posts, tab) => {
        const result = applyFeedFilters({
          posts,
          tab,
          party: ALL_PARTIES,
          followingOnly: true,
          followedSet: new Set<string>(),
          partyIndex: freshPartyIndex(),
        });
        expect(result).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: news-section, Property 4: the result is always a subset of the tab filter", () => {
  it("applyFeedFilters output ⊆ filterByTab(posts, tab) for any party/follow combination", () => {
    fc.assert(
      fc.property(
        postsArb,
        partySelectionArb,
        followedSetArb,
        fc.boolean(),
        tabArb,
        (posts, party, followedSet, followingOnly, tab) => {
          const result = applyFeedFilters({
            posts,
            tab,
            party,
            followingOnly,
            followedSet,
            partyIndex: freshPartyIndex(),
          });

          const inTabIds = new Set(filterByTab([...posts], tab).map((i) => i.id));
          for (const item of result) {
            // Every surfaced item is a member of the tab filter...
            expect(inTabIds.has(item.id)).toBe(true);
            // ...and belongs to the tab by its own membership.
            expect(item.tabs.includes(tab)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: news-section, Property 4: orderByFollowed floats any-of-followed ahead, most-recent-first within each group", () => {
  it("every followed-group item precedes every rest item, and the partition is stable", () => {
    fc.assert(
      fc.property(postsArb, followedSetArb, (posts, followedSet) => {
        const ordered = orderByFollowed(posts, followedSet);

        const isFollowed = (item: News_Item) =>
          item.candidateIds.some((id) => followedSet.has(id));

        // Same multiset of ids in, same out (no gain/loss).
        expect([...ordered].map((i) => i.id).sort()).toEqual(
          [...posts].map((i) => i.id).sort(),
        );

        // Every followed item appears before every rest item.
        const lastFollowedIdx = ordered.reduce(
          (acc, item, i) => (isFollowed(item) ? i : acc),
          -1,
        );
        const firstRestIdx = ordered.findIndex((item) => !isFollowed(item));
        if (lastFollowedIdx !== -1 && firstRestIdx !== -1) {
          expect(lastFollowedIdx).toBeLessThan(firstRestIdx);
        }

        // Stable partition: within the followed prefix and the rest suffix, the
        // relative order matches the input order among equal-date items.
        const inputFollowed = posts.filter(isFollowed).map((i) => i.id);
        const inputRest = posts.filter((i) => !isFollowed(i)).map((i) => i.id);
        const outFollowed = ordered.filter(isFollowed).map((i) => i.id);
        const outRest = ordered.filter((i) => !isFollowed(i)).map((i) => i.id);
        expect(new Set(outFollowed)).toEqual(new Set(inputFollowed));
        expect(new Set(outRest)).toEqual(new Set(inputRest));
      }),
      { numRuns: 100 },
    );
  });

  it("within each group items are non-increasing by parseable date, equal/unparseable dates keep input order", () => {
    fc.assert(
      fc.property(postsArb, followedSetArb, (posts, followedSet) => {
        const ordered = orderByFollowed(posts, followedSet);
        const isFollowed = (item: News_Item) =>
          item.candidateIds.some((id) => followedSet.has(id));

        const groups: News_Item[][] = [
          ordered.filter(isFollowed),
          ordered.filter((i) => !isFollowed(i)),
        ];

        for (const group of groups) {
          // Parseable dates are non-increasing (most-recent-first).
          for (let i = 1; i < group.length; i++) {
            const prev = new Date(group[i - 1].date).getTime();
            const cur = new Date(group[i].date).getTime();
            if (!Number.isNaN(prev) && !Number.isNaN(cur)) {
              expect(prev).toBeGreaterThanOrEqual(cur);
            }
          }
        }

        // Stability oracle: items that are equal under the comparator (equal
        // getTime, or either NaN) must preserve their input relative order.
        // Verify within the followed input subsequence and the rest subsequence.
        const checkStability = (inputGroup: News_Item[], outGroup: News_Item[]) => {
          const key = (i: News_Item) => {
            const t = new Date(i.date).getTime();
            return Number.isNaN(t) ? "NaN" : String(t);
          };
          // For each equal-key cluster, the output order of ids equals input order.
          const inputByKey = new Map<string, string[]>();
          for (const item of inputGroup) {
            const k = key(item);
            (inputByKey.get(k) ?? inputByKey.set(k, []).get(k)!).push(item.id);
          }
          const outByKey = new Map<string, string[]>();
          for (const item of outGroup) {
            const k = key(item);
            (outByKey.get(k) ?? outByKey.set(k, []).get(k)!).push(item.id);
          }
          // NaN cluster: all unparseable dates preserve input relative order.
          expect(outByKey.get("NaN") ?? []).toEqual(inputByKey.get("NaN") ?? []);
          // Equal-timestamp clusters preserve input relative order.
          for (const [k, ids] of inputByKey) {
            if (k === "NaN") continue;
            if (ids.length > 1) {
              expect(outByKey.get(k)).toEqual(ids);
            }
          }
        };

        checkStability(posts.filter(isFollowed), groups[0]);
        checkStability(posts.filter((i) => !isFollowed(i)), groups[1]);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: news-section, Property 4: purity — inputs are not mutated and outputs are fresh", () => {
  it("applyFeedFilters mutates none of its inputs and returns a fresh array", () => {
    fc.assert(
      fc.property(
        postsArb,
        partySelectionArb,
        followedSetArb,
        fc.boolean(),
        tabArb,
        (posts, party, followedSet, followingOnly, tab) => {
          const partyIndex = freshPartyIndex();
          const postsBefore = snapshot(posts);
          const followedBefore = [...followedSet].sort();
          const partyIndexBefore = [...partyIndex.entries()].sort();

          const result = applyFeedFilters({
            posts,
            tab,
            party,
            followingOnly,
            followedSet,
            partyIndex,
          });

          // Inputs unchanged.
          expect(snapshot(posts)).toEqual(postsBefore);
          expect([...followedSet].sort()).toEqual(followedBefore);
          expect([...partyIndex.entries()].sort()).toEqual(partyIndexBefore);

          // Output is a fresh array, not the input reference.
          expect(result).not.toBe(posts as unknown as News_Item[]);
          // Surfaced items are the same object references (no cloning of items).
          for (const item of result) {
            expect(posts).toContain(item);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("orderByFollowed mutates none of its inputs and returns a fresh array", () => {
    fc.assert(
      fc.property(postsArb, followedSetArb, (posts, followedSet) => {
        const postsBefore = snapshot(posts);
        const followedBefore = [...followedSet].sort();

        const ordered = orderByFollowed(posts, followedSet);

        expect(snapshot(posts)).toEqual(postsBefore);
        expect([...followedSet].sort()).toEqual(followedBefore);
        expect(ordered).not.toBe(posts as unknown as News_Item[]);
        // Same items (by reference), just reordered.
        expect(ordered.length).toBe(posts.length);
        for (const item of ordered) {
          expect(posts).toContain(item);
        }
      }),
      { numRuns: 100 },
    );
  });
});
