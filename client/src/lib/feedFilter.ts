/**
 * Pure, React-free filtering for the Tweets feed.
 *
 * Combines the existing tab filter with a party filter and a following-only
 * filter. Lives beside `tweetFilter.ts` in `client/src/lib/` so it can be
 * imported and property-tested without pulling in React (Req 7.3), and exposes
 * an explicit, data-only input contract (Req 7.2). It depends only on its
 * parameters, mutates nothing, and returns freshly allocated arrays.
 *
 * Function implementations are filled in by later tasks (1.2, 1.4, 2.1, 2.2);
 * this module establishes the scaffolding, the `"all"` sentinel, and the types.
 */
import type { News_Item, Party, TweetTab } from "../types/domain";
import { filterByTab } from "./tweetFilter";

/** Sentinel meaning "no party restriction". */
export const ALL_PARTIES = "all" as const;

/** The Party_Filter selection: a specific Party or the "all" sentinel. */
export type PartySelection = Party | typeof ALL_PARTIES;

/** Maps a candidateId to its Party. A missing key ⇒ an unresolved id. */
export type PartyIndex = ReadonlyMap<string, Party>;

/** Explicit inputs to the combined filter (Req 7.2). */
export interface FeedFilterInput {
  posts: readonly News_Item[];
  tab: TweetTab;
  party: PartySelection;
  followingOnly: boolean;
  followedSet: ReadonlySet<string>;
  partyIndex: PartyIndex;
}

/**
 * Return the subset of `posts` satisfying the active tab, party, and
 * following-only filters, in the same relative order as the input. Pure: no
 * mutation of any input, same output for same inputs (Req 7.1, 7.4, 5.4, 5.6).
 *
 * Composes three independent predicates over the posts and keeps a post only
 * when it satisfies all three at once (Req 5.1):
 *
 * - **Tab:** delegated to `filterByTab`, so the tab predicate is defined in one
 *   place. With `party === ALL_PARTIES` and `followingOnly === false` the
 *   output matches `filterByTab(posts, tab)` in membership and order (Req 7.5,
 *   5.2, 5.3).
 * - **Party:** `ALL_PARTIES` passes every item (Req 1.3, 2.4, 5.2); otherwise
 *   an item passes only when ANY of its `candidateIds` resolves to the selected
 *   party — `item.candidateIds.some(id => partyIndex.get(id) === party)` — so an
 *   item whose ids resolve to no party (Unresolved) is excluded while a specific
 *   party is selected (Req 1.4, 1.5, 2.3, 5.5, 7.7, 2.7, 3.4).
 * - **Following:** `!followingOnly` passes every item (Req 3.3, 5.3); otherwise
 *   an item passes only when ANY of its `candidateIds` is in the followed set —
 *   `item.candidateIds.some(id => followedSet.has(id))` — so items touching no
 *   followed candidate are excluded and an empty `followedSet` simply yields
 *   `[]` rather than an error (Req 3.4, 3.7, 4.1, 7.6, 2.7).
 *
 * `filterByTab` already returns a newly allocated array; the single `filter`
 * pass over it produces a fresh array and never writes to `posts`,
 * `followedSet`, or `partyIndex` (Req 5.4, 5.6, 7.1, 7.4). When nothing
 * qualifies the result is an empty array, not an error.
 */
export function applyFeedFilters(input: FeedFilterInput): News_Item[] {
  const { posts, tab, party, followingOnly, followedSet, partyIndex } = input;

  return filterByTab([...posts], tab).filter((item) => {
    const partyOk =
      party === ALL_PARTIES ||
      item.candidateIds.some((id) => partyIndex.get(id) === party);
    if (!partyOk) return false;

    const followingOk =
      !followingOnly || item.candidateIds.some((id) => followedSet.has(id));
    return followingOk;
  });
}

/**
 * Resolve an item's Party through the Party_Index via any-of over its
 * `candidateIds`, returning `undefined` when none of the ids resolves
 * (an Unresolved item) (Req 2.1, 2.2, 2.7, 3.4).
 *
 * An item can span multiple candidates/parties, so it resolves to the Party of
 * the FIRST of its `candidateIds` that is a key of the index; ids that are
 * absent, null, or empty — or present but not a key — are skipped. If no id
 * resolves, the result is `undefined`, which the party filter treats as an
 * Unresolved item (excluded while a specific party is selected). The lookup is
 * read-only and never mutates the index or the item.
 */
export function resolveParty(
  item: News_Item,
  partyIndex: PartyIndex,
): Party | undefined {
  // Guard against null/absent/empty ids that may arrive from unvalidated
  // runtime data; the first id that resolves wins (any-of).
  for (const candidateId of item.candidateIds) {
    if (!candidateId) continue;
    const party = partyIndex.get(candidateId);
    if (party !== undefined) return party;
  }
  return undefined;
}

/**
 * Build the Party_Index — a `candidateId → Party` map — from candidate records
 * (Req 2.1). Keyed by `id`; on duplicate ids the last record wins, matching the
 * insertion-order overwrite semantics of `Map`. Ids are expected to be unique.
 */
export function buildPartyIndex(
  candidates: readonly { id: string; party: Party }[],
): PartyIndex {
  const index = new Map<string, Party>();
  for (const candidate of candidates) {
    index.set(candidate.id, candidate.party);
  }
  return index;
}

/**
 * Return the distinct parties present among `candidates`, each exactly once,
 * in ascending alphabetical order (Req 1.1). An empty candidate list yields an
 * empty array, so the Party_Filter then offers only the "All parties" sentinel
 * (Req 1.6).
 *
 * De-duplication uses a `Set` keyed by the party string; ordering uses the
 * default lexicographic comparator, which sorts the `Party` string-union values
 * ascending alphabetically. The input is only read — never mutated — and a
 * freshly allocated array is returned.
 */
export function partyOptions(
  candidates: readonly { party: Party }[],
): Party[] {
  const distinct = new Set<Party>();
  for (const candidate of candidates) {
    distinct.add(candidate.party);
  }
  return [...distinct].sort((a, b) => a.localeCompare(b));
}

/**
 * Order the feed followed-first, most-recent-first within each group (Req 5.7,
 * 2.8, 3.4), returning a freshly allocated array and mutating nothing.
 *
 * An item is "followed" iff ANY of its `candidateIds` is in `followedSet`
 * (any-of). Items are stably partitioned into the followed group ahead of the
 * rest, then each group is independently ordered most-recent-first by `date`
 * (an ISO 8601 string): timestamps are parsed with `new Date(item.date)` and
 * compared descending (newer first). Items with equal — or unparseable, hence
 * `NaN` — timestamps keep their input relative order. Unparseable dates are
 * treated as the oldest possible (they sort to the end of their group), and
 * `byDateDesc` sorts on a total order with an input-index tiebreak so ties
 * preserve order without depending on the engine's sort stability. Each group
 * is spread before sorting so neither `list` nor its items are mutated, and the
 * returned array is newly allocated. `followedSet` is only read.
 */
export function orderByFollowed(
  list: readonly News_Item[],
  followedSet: ReadonlySet<string>,
): News_Item[] {
  const followed: News_Item[] = [];
  const rest: News_Item[] = [];
  for (const item of list) {
    (item.candidateIds.some((id) => followedSet.has(id)) ? followed : rest).push(
      item,
    );
  }
  return [...byDateDesc(followed), ...byDateDesc(rest)];
}

/**
 * Stable most-recent-first ordering by ISO 8601 `date`. Returns a fresh array.
 *
 * Uses a decorate-sort-undecorate (Schwartzian) pass so the comparator is a
 * TRUE total order rather than a partial one. Each item is paired with its
 * original index `i` and a numeric `key`: the parsed timestamp for parseable
 * dates, or `-Infinity` for unparseable (`NaN`) dates so they deterministically
 * sort to the end of the group (treated as the oldest). The comparator orders
 * by `key` descending (newer first) and, for equal keys — including the whole
 * all-`-Infinity` unparseable cluster — breaks ties by ascending original
 * index. This guarantees transitivity and exact input-order stability for ties
 * independent of the engine's sort stability, fixing the prior comparator that
 * returned 0 whenever either operand was `NaN` (non-transitive, which could
 * misorder even unrelated parseable items and scramble equal-date clusters).
 */
function byDateDesc(group: readonly News_Item[]): News_Item[] {
  return group
    .map((item, i) => {
      const t = new Date(item.date).getTime();
      return { item, i, key: Number.isNaN(t) ? -Infinity : t };
    })
    .sort((a, b) => (a.key === b.key ? a.i - b.i : b.key - a.key))
    .map(({ item }) => item);
}
