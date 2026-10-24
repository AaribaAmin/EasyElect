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
import type { Party, Tweet, TweetTab } from "../types/domain";
import { filterByTab } from "./tweetFilter";

/** Sentinel meaning "no party restriction". */
export const ALL_PARTIES = "all" as const;

/** The Party_Filter selection: a specific Party or the "all" sentinel. */
export type PartySelection = Party | typeof ALL_PARTIES;

/** Maps a candidateId to its Party. A missing key ⇒ Unresolved_Post. */
export type PartyIndex = ReadonlyMap<string, Party>;

/** Explicit inputs to the combined filter (Req 7.2). */
export interface FeedFilterInput {
  posts: readonly Tweet[];
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
 * - **Party:** `ALL_PARTIES` passes every post (Req 1.3, 2.4, 5.2); otherwise a
 *   post passes only when `resolveParty(post, partyIndex) === party`, so an
 *   Unresolved_Post is excluded (Req 1.4, 1.5, 2.3, 5.5, 7.7).
 * - **Following:** `!followingOnly` passes every post (Req 3.3, 5.3); otherwise
 *   a post passes only when `followedSet.has(post.candidateId)`, so unknown or
 *   unfollowed candidates are excluded and an empty `followedSet` simply yields
 *   `[]` rather than an error (Req 3.4, 3.7, 4.1, 7.6).
 *
 * `filterByTab` already returns a newly allocated array; the single `filter`
 * pass over it produces a fresh array and never writes to `posts`,
 * `followedSet`, or `partyIndex` (Req 5.4, 5.6, 7.1, 7.4). When nothing
 * qualifies the result is an empty array, not an error.
 */
export function applyFeedFilters(input: FeedFilterInput): Tweet[] {
  const { posts, tab, party, followingOnly, followedSet, partyIndex } = input;

  return filterByTab([...posts], tab).filter((post) => {
    const partyOk =
      party === ALL_PARTIES || resolveParty(post, partyIndex) === party;
    if (!partyOk) return false;

    const followingOk = !followingOnly || followedSet.has(post.candidateId);
    return followingOk;
  });
}

/**
 * Resolve a Post's Party through the Party_Index, returning `undefined` when
 * the Post is an Unresolved_Post (Req 2.1, 2.2).
 *
 * A Post resolves to the Party recorded for the entry whose key equals the
 * Post's `candidateId` (Req 2.1). A `candidateId` that is absent, null, or
 * empty — or present but not a key of the index — yields `undefined`, which the
 * caller treats as the Unresolved_Post classification (Req 2.2). The lookup is
 * read-only (O(1)) and never mutates the index.
 */
export function resolveParty(
  post: Tweet,
  partyIndex: PartyIndex,
): Party | undefined {
  // `candidateId` is typed `string`, but guard against null/absent/empty values
  // that may arrive from unvalidated runtime data: all classify as Unresolved.
  const candidateId = post.candidateId;
  if (!candidateId) return undefined;
  return partyIndex.get(candidateId);
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
 * Stably partition posts authored by a followed candidate ahead of the rest,
 * preserving relative order within each group; returns a new array (Req 5.7).
 *
 * Extracted from `TweetsPage` in task 2.2.
 */
export function orderByFollowed(
  list: readonly Tweet[],
  followedSet: ReadonlySet<string>,
): Tweet[] {
  const followed: Tweet[] = [];
  const rest: Tweet[] = [];
  for (const post of list) {
    (followedSet.has(post.candidateId) ? followed : rest).push(post);
  }
  return [...followed, ...rest];
}
