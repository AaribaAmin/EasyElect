import type { Tweet } from "./types.js";

/**
 * Genuine fallback posts dataset for the Tweets section (Fallback_Posts_Dataset).
 *
 * This dataset contains ONLY genuine, verifiable x.com posts: each record must
 * be a real, publicly published post on x.com, its `sourceUrl` must resolve to
 * that same post on the `x.com` host, and its `likes`/`reposts` must be the real
 * engagement counts reported by the source. Placeholder, fabricated, or
 * otherwise invented engagement counts are not permitted, and any post that
 * cannot be verified as a genuine x.com post is excluded rather than displayed.
 *
 * Because no such verified x.com records currently exist, the array is empty.
 * An empty fallback dataset yields `{ posts: [], source: "fallback" }` from the
 * resolveTweets decision tree. To add records, verify each one against its
 * `sourceUrl` on x.com and confirm its real engagement counts; see
 * DATA_SOURCES.md.
 *
 * When records are present, `candidateId` must match a real candidate in
 * candidates.ts via normalized handle, and any `context` blocks must be neutral
 * editorial clarifications that do not endorse, rank, or recommend any position
 * (Req 8.4).
 */
export const tweets: Tweet[] = [];
