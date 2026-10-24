/**
 * Pure tab-membership filtering for the Tweets feed.
 *
 * Requirement 7.6: the four tabs (recent, notable, needsContext, interactions)
 * filter the served posts by tab membership — a post appears in tab `T` exactly
 * when `T` is contained in the post's `tabs`. Extracting the predicate here (out
 * of `TweetsPage`) lets it be unit- and property-tested in isolation (see the
 * tab-membership preservation property test, design Property 16).
 */
import type { News_Item, TweetTab } from "../types/domain";

/**
 * Return the items assigned to `tab`, preserving input order. An item is
 * included exactly when `tab` is a member of its `tabs` array; no item is added
 * to a tab it was not assigned to, and none is dropped from a tab it was
 * assigned to. The input array and its elements are never mutated.
 */
export function filterByTab(posts: News_Item[], tab: TweetTab): News_Item[] {
  return posts.filter((post) => post.tabs.includes(tab));
}
