# Bugfix Requirements Document

## Introduction

The Tweets section is required to display only genuine posts that originate from x.com (Twitter/X), with engagement metrics (likes and reposts) that reflect real values from the source. Two defects break this guarantee:

1. **Falsified engagement counts.** The served posts can carry `likes`/`reposts` values that were not obtained from the real post. The fallback dataset (`server/src/domain/tweets.ts`) hardcodes engagement numbers that its own documentation describes as "display-only placeholders" used "where exact engagement counts are unavailable." These fabricated numbers are rendered in `TweetCard.tsx` as if they were real.

2. **Posts not sourced from x.com.** Posts shown in the section are not guaranteed to be genuine x.com posts. The fallback records are paraphrased summaries of statements whose `sourceUrl` points to news and government domains (mass.gov, wbur.org, bostonglobe.com, nbcboston.com, cbsnews.com, yahoo.com, and a campaign site) rather than to a real post on x.com. The live-fetch path (`server/src/posts/provider.ts`) retrieves real posts but builds the back-link on the `twitter.com` host rather than `x.com`.

A post qualifies as genuine only when it is a real, publicly published x.com post: its back-link (`sourceUrl`) resolves to that post on x.com, and its `likes`/`reposts` are the actual counts reported by the source. The fix must guarantee that every post the section displays meets this bar, and that no displayed engagement count is invented, placeholder, or otherwise disconnected from the real post. The behavior of the live-fetch pipeline for posts that already carry real source metrics, and all non-Tweets sections of the app, must be preserved.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Tweets feed is served from the fallback dataset (live posting disabled, or a live fetch fails or is rate-limited with an empty cache resolving to fallback) THEN the system displays posts whose `likes` and `reposts` are hardcoded placeholder values not obtained from any real post.

1.2 WHEN the Tweets feed is served from the fallback dataset THEN the system displays posts whose `sourceUrl` points to a non-x.com domain (for example mass.gov, wbur.org, bostonglobe.com, nbcboston.com, cbsnews.com, yahoo.com, or a campaign website) rather than to a genuine post on x.com.

1.3 WHEN a post displayed in the Tweets section has no verifiable genuine x.com origin THEN the system still renders it in the feed as though it were a real x.com post.

1.4 WHEN the live-fetch path maps a real post THEN the system builds the back-link (`sourceUrl`) on the `twitter.com` host rather than on `x.com`.

### Expected Behavior (Correct)

2.1 WHEN the Tweets feed is served and a post's `likes`/`reposts` are not the real counts obtained from its genuine x.com source THEN the system SHALL NOT display fabricated or placeholder engagement counts for that post.

2.2 WHEN the Tweets feed is served THEN every displayed post's `sourceUrl` SHALL resolve to that same post on x.com (the x.com host, linking to the original post).

2.3 WHEN a post cannot be verified as a genuine, publicly published x.com post THEN the system SHALL exclude it from the Tweets feed rather than display it.

2.4 WHEN the live-fetch path maps a real post THEN the system SHALL build the back-link (`sourceUrl`) on the `x.com` host pointing to the original post.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the live-fetch path returns a genuine, publicly published x.com post that already carries real engagement counts and matches a known candidate handle THEN the system SHALL CONTINUE TO display that post with its real `likes` and `reposts` values.

3.2 WHEN the Tweets section renders THEN the system SHALL CONTINUE TO support the four tabs (recent, notable, needsContext, interactions), tab-membership filtering, followed-candidate ordering, and the "Added context" blocks for displayed posts.

3.3 WHEN a view renders live post content THEN the system SHALL CONTINUE TO show the origin indicator (Live / Cached / Fallback) and the external-social-API usage/attribution notice.

3.4 WHEN any section other than Tweets is used (candidates, issues, causes, connect, election, quiz) THEN the system SHALL CONTINUE TO behave exactly as before.

3.5 WHEN the public-only, full-attribution, and candidate-handle-match filtering runs in the live-fetch pipeline THEN the system SHALL CONTINUE TO drop posts that are not publicly confirmed, are missing required attribution, or match no candidate handle.
