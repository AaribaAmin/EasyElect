# Bugfix Requirements Document

## Introduction

The Tweets section renders no posts in any of its four tabs (Recent, Notable, Needs Context, Interactions). Every tab shows the "No posts in this tab yet." empty state, so the section appears broken to the user.

The root cause is the fallback posts dataset. In `client/src/pages/TweetsPage.tsx` the feed fetches `GET /api/tweets`, validates the envelope, filters posts by tab, and shows the empty state when the filtered list is empty. On the server, `resolveTweets()` in `server/src/routes/data.ts` follows a cache → live → fallback decision tree; when live posting is not configured (no credentials) it serves `fallbackResponse() = { posts: tweets, source: "fallback" }`. The fallback dataset `tweets` in `server/src/domain/tweets.ts` is `[]` — intentionally empty, because a prior fix (`tweets-section-genuine-x-posts`) requires the fallback to contain only genuine, verified x.com posts and to stay empty until such posts are verified. With live posting disabled, every request resolves to this empty fallback, so all four tabs are empty.

The chosen fix is to populate the fallback dataset with genuine, verified x.com posts that satisfy the existing genuine-only guarantee: each record must be a real, publicly published x.com post whose `sourceUrl` resolves to that post on the `x.com` host, carrying the real engagement counts reported by the source and attributed to a known candidate handle. The fix must NOT weaken the genuine-only guarantee or the existing property tests — it removes the emptiness by supplying verified records, not by relaxing verification. All other Tweets behavior (tab filtering, followed-candidate ordering, origin indicator, the live-fetch pipeline) and every non-Tweets section must be preserved.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Tweets section loads with live posting disabled (no credentials) THEN the system serves the empty fallback dataset and every tab (Recent, Notable, Needs Context, Interactions) shows "No posts in this tab yet."

1.2 WHEN a live fetch fails or is rate-limited with an empty cache and the request resolves to fallback THEN the system serves zero posts, leaving all four tabs empty.

1.3 WHEN genuine, verifiable x.com posts for the known candidates are available to seed the fallback dataset THEN the system still serves an empty fallback and displays no posts.

### Expected Behavior (Correct)

2.1 WHEN the Tweets section loads with live posting disabled (no credentials) THEN the system SHALL serve a non-empty fallback dataset of genuine x.com posts, and at least the Recent tab SHALL display one or more posts instead of the empty state.

2.2 WHEN a live fetch fails or is rate-limited with an empty cache and the request resolves to fallback THEN the system SHALL serve the genuine fallback posts so the section is populated rather than empty.

2.3 WHEN a post is added to the fallback dataset THEN the system SHALL require it to be a genuine x.com post: its `sourceUrl` SHALL resolve to that post on the `x.com` host, its `likes`/`reposts` SHALL be the real counts reported by the source (never placeholder or fabricated values), and its `authorHandle` SHALL match a known candidate via normalized handle.

2.4 WHEN a candidate record is assigned fallback posts THEN the system SHALL attribute each post to that candidate through `candidateId` matching a real candidate in `candidates.ts`.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the live-fetch path returns a genuine, publicly published x.com post that already carries real engagement counts and matches a known candidate handle THEN the system SHALL CONTINUE TO display that post with its real `likes` and `reposts` values.

3.2 WHEN the Tweets section renders THEN the system SHALL CONTINUE TO support the four tabs, tab-membership filtering via `filterByTab`, followed-candidate ordering, and the "Added context" blocks for posts that carry context.

3.3 WHEN the feed renders THEN the system SHALL CONTINUE TO show the origin indicator (Live / Cached / Fallback) for the served source.

3.4 WHEN the fallback dataset is served THEN the system SHALL CONTINUE TO satisfy the genuine-only guarantee and its property tests: the dataset holds between 0 and 50 records, every record's `sourceUrl` resolves to the `x.com` host, and no record carries placeholder or fabricated engagement counts.

3.5 WHEN the public-only, full-attribution, and candidate-handle-match filtering runs in the live-fetch pipeline THEN the system SHALL CONTINUE TO drop posts that are not publicly confirmed, are missing required attribution, or match no candidate handle.

3.6 WHEN any section other than Tweets is used (candidates, issues, causes, connect, election, quiz) THEN the system SHALL CONTINUE TO behave exactly as before.
