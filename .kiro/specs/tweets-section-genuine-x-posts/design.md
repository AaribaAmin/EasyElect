# Tweets Section Genuine X Posts Bugfix Design

## Overview

The Tweets section must display only genuine, publicly published x.com posts whose back-link resolves to that post on x.com and whose `likes`/`reposts` are the real counts reported by the source. Two defects break this guarantee:

1. **Fabricated engagement on fallback posts.** The fallback dataset in `server/src/domain/tweets.ts` hardcodes `likes`/`reposts` values its own header comment describes as "display-only placeholders" used "where exact engagement counts are unavailable." Those numbers never came from a real post, yet `TweetCard.tsx` renders them (`♥ {tweet.likes}`, `🔁 {tweet.reposts}`) as if they were genuine.
2. **Non-x.com origins.** The same fallback records carry `sourceUrl` values that point to news and government domains (mass.gov, wbur.org, bostonglobe.com, nbcboston.com, cbsnews.com, yahoo.com, and a campaign site), not to a post on x.com. Separately, the live-fetch adapter in `server/src/posts/provider.ts` builds its back-link on the `twitter.com` host (`https://twitter.com/${handle}/status/${id}`) rather than `x.com`.

The fix is targeted and minimal:

- **Fallback path:** a post is "genuine" only when it is a real x.com post with real engagement counts and an x.com back-link. The fallback records satisfy none of those conditions (paraphrased text, placeholder counts, non-x.com links), so per Expected Behavior 2.2 and 2.3 they must be **excluded** rather than displayed. The dataset is reduced to an empty set, so the `fallback` source serves zero posts.
- **Live path:** change the single URL template in `adaptRawResponse` so the back-link is built on the `x.com` host, which is the genuine origin of the post.

Everything the live-fetch pipeline already does for genuine, real-metric posts — public-only / full-attribution / handle-match filtering, caching, the four tabs, followed-candidate ordering, the origin indicator, and the usage/attribution notice — is preserved. The change set is two files: the fallback dataset and one line of the live adapter.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a post reaches the Tweets feed without being a genuine x.com post, i.e. it carries engagement counts not obtained from a real x.com post, or a `sourceUrl` that does not resolve to that post on the `x.com` host.
- **Property (P)**: The desired behavior — the feed contains only genuine x.com posts: every displayed post has an `x.com` back-link to the original post and real engagement counts, and any post that cannot be verified as such is excluded.
- **Preservation**: Behavior that must remain unchanged — genuine live posts with real counts still display with their real values; tabs, tab-membership filtering, followed-candidate ordering, added-context blocks, the origin indicator (Live/Cached/Fallback), the usage/attribution notice, the public-only/attribution/handle-match live filtering, and every non-Tweets section all behave exactly as before.
- **Fallback_Posts_Dataset (`tweets`)**: The static `Tweet[]` exported from `server/src/domain/tweets.ts`, served by `GET /api/tweets` with `source: "fallback"` when live posting is disabled, or when a live fetch fails/rate-limits with an empty cache.
- **adaptRawResponse**: The function in `server/src/posts/provider.ts` that maps a vendor search response into `RawPost[]`, including building the `url` back-link later used as `Tweet.sourceUrl`.
- **PostsSource**: The `source` field of the `TweetsResponse` envelope — `"live" | "cache" | "fallback"` — that drives the origin indicator in `PostsStatus.tsx`.

## Bug Details

### Bug Condition

The bug manifests whenever a post that is **not** a genuine x.com post is served into the Tweets feed. A post is genuine only when its back-link resolves to the original post on the `x.com` host AND its `likes`/`reposts` are the real counts obtained from that post. The fallback records fail both tests (placeholder counts, non-x.com `sourceUrl`), and the live adapter fails the host test (builds the link on `twitter.com`).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { post: Tweet, source: PostsSource }
  OUTPUT: boolean

  // A served post is buggy when it is NOT a genuine x.com post:
  RETURN postIsDisplayed(input.post, input.source)
         AND NOT (
           hostOf(input.post.sourceUrl) == "x.com"
           AND engagementCountsAreReal(input.post)
         )
END FUNCTION
```

Where:
- `hostOf(sourceUrl)` is the host of the back-link; genuine posts use `x.com`.
- `engagementCountsAreReal(post)` is true only when `likes`/`reposts` were obtained from the real x.com post (true for live/cache posts mapped from `public_metrics`; false for the fallback dataset's placeholder values).

### Examples

- **Fallback placeholder counts (buggy):** Record `t1` (@maura_healey) is served with `likes: 2140, reposts: 540` — numbers the dataset documents as display-only placeholders. Expected: not displayed, because the counts are not real and the origin is not x.com.
- **Fallback non-x.com link (buggy):** Record `t7` (@minogueforma) has `sourceUrl: "https://www.wbur.org/news/2026/09/11/..."`. Expected: not displayed, because the back-link does not resolve to a post on x.com.
- **Live post, twitter.com host (buggy):** `adaptRawResponse` maps a real post from @maura_healey to `sourceUrl: "https://twitter.com/maura_healey/status/123"`. Expected: `sourceUrl: "https://x.com/maura_healey/status/123"`.
- **Live post, real counts (genuine — must keep working):** A mapped live post with `likes`/`reposts` from `public_metrics` and an `x.com` back-link. Expected: displayed unchanged with its real counts.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Genuine live posts that already carry real engagement counts, match a known candidate handle, and are publicly published continue to display with their real `likes`/`reposts` values (Req 3.1).
- The four tabs (recent, notable, needsContext, interactions), tab-membership filtering (`filterByTab`), followed-candidate ordering (`orderByFollowed` in `TweetsPage.tsx`), and the "Added context" blocks all continue to work for displayed posts (Req 3.2).
- The origin indicator (Live / Cached / Fallback in `PostsStatus.tsx`) and the external-social-API usage/attribution notice continue to render on views showing live post content (Req 3.3).
- Every non-Tweets section — candidates, issues, causes, connect, election, quiz — behaves exactly as before (Req 3.4).
- The public-only, full-attribution, and candidate-handle-match filtering in the live-fetch pipeline (`mapRawPost` / `mapRawPosts`) continues to drop posts that are not publicly confirmed, are missing attribution, or match no candidate handle (Req 3.5).

**Scope:**
All behavior for inputs that are **already** genuine x.com posts with real counts, and all behavior outside the Tweets feed, must be completely unaffected by this fix. This includes:
- Live/cache posts mapped from the external API with real `public_metrics` counts.
- Tab switching, followed ordering, and context rendering for any displayed post.
- The `source` envelope field and its three values, the `/api/tweets/status` endpoint, caching freshness, and the 10s-timeout / rate-limit / failure decision tree in `resolveTweets`.
- Every other data endpoint and client page.

## Hypothesized Root Cause

Based on the defect report and the code, the causes are:

1. **Placeholder engagement in the fallback dataset.** `server/src/domain/tweets.ts` assigns hardcoded `likes`/`reposts` to each record. The header comment confirms these are "display-only placeholders" used where real counts are unavailable — they are not sourced from any real post, so any displayed fallback count is fabricated (Defect 1).

2. **Non-x.com `sourceUrl` in the fallback dataset.** Each fallback record's `sourceUrl` points to a news/government/campaign domain documenting a paraphrased statement, not to a real post on x.com. These records therefore are not genuine x.com posts at all (Defect 2, fallback half).

3. **`twitter.com` host in the live adapter.** `adaptRawResponse` builds the back-link as `https://twitter.com/${handle}/status/${id}`. The genuine origin host is `x.com`; the literal `twitter.com` is the defect (Defect 2, live half).

4. **No genuineness gate at the point a fallback post is served.** `fallbackResponse()` returns the dataset verbatim, so any non-genuine record in `tweets` is rendered as though it were a real x.com post (Req 1.3). Reducing the dataset to only genuine records (currently: none) removes the non-genuine output at its source.

## Correctness Properties

Property 1: Bug Condition - Only genuine x.com posts are displayed

_For any_ post served into the Tweets feed where the bug condition holds (the post is displayed but is not a genuine x.com post — its `sourceUrl` host is not `x.com`, or its engagement counts were not obtained from the real post), the fixed system SHALL NOT display that post with fabricated or placeholder engagement counts and SHALL instead either (a) serve it with an `x.com` back-link and real counts when it is a genuine live/cache post, or (b) exclude it from the feed when it cannot be verified as a genuine, publicly published x.com post.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Genuine posts and non-Tweets behavior unchanged

_For any_ input where the bug condition does NOT hold — a genuine live/cache x.com post that already carries real engagement counts and matches a known candidate handle, or any interaction with a non-Tweets section — the fixed system SHALL produce the same result as the original system, preserving real-count display, the four tabs and their membership filtering, followed-candidate ordering, added-context blocks, the origin indicator, the usage/attribution notice, the public-only/attribution/handle-match live filtering, and every non-Tweets section.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming the root-cause analysis is correct, two files change.

**File**: `server/src/posts/provider.ts`

**Function**: `adaptRawResponse`

**Specific Changes**:
1. **x.com back-link host**: Change the single back-link template from the `twitter.com` host to the `x.com` host, so a mapped live post's `sourceUrl` resolves to the original post on x.com (Req 2.4).
   - Before: `url: handle && id ? \`https://twitter.com/${handle}/status/${id}\` : undefined`
   - After: `url: handle && id ? \`https://x.com/${handle}/status/${id}\` : undefined`
   - This is the only host literal involved; the search endpoint, auth scheme, and response adaptation are untouched, so the public-only / attribution / handle-match pipeline (Req 3.5) and real-count mapping (Req 3.1) are unchanged.

**File**: `server/src/domain/tweets.ts`

**Function/Export**: `tweets` (Fallback_Posts_Dataset)

**Specific Changes**:
2. **Exclude non-genuine fallback records**: Reduce the exported `tweets` array to only genuine x.com posts with real engagement counts and `x.com` back-links. None of the current records qualify (placeholder counts, non-x.com `sourceUrl`, paraphrased text), so the array becomes empty (`export const tweets: Tweet[] = [];`). This makes the `fallback` source serve zero posts rather than non-genuine ones (Req 2.2, 2.3) and removes all fabricated engagement from the fallback path (Req 2.1).
3. **Update the header documentation**: Rewrite the file header to state that the dataset contains only genuine, verifiable x.com posts with real engagement counts and `x.com` back-links, and that it is empty whenever no such verified records exist (removing the "display-only placeholders" language, which described the defect).
4. **No type or envelope change**: `Tweet`, `TweetsResponse`, `PostsSource`, and the `fallbackResponse()`/`resolveTweets()` decision tree are unchanged. An empty fallback simply yields `{ posts: [], source: "fallback" }`, which `TweetsPage.tsx` already renders as the existing "No posts in this tab yet." empty state while still showing the origin indicator and notice.

### Interaction With Existing Tests (must be updated)

This fix deliberately changes the observable contract of the fallback dataset, so three existing property tests that assert the old (buggy) contract must be updated to the new expected behavior:
- `server/src/domain/tweets.property.test.ts` (Property 20) asserts the dataset has between 1 and 50 records. Update it to allow an empty dataset and, for any record present, require an `x.com` `sourceUrl` host and real engagement counts.
- `server/src/routes/data.tweetsFailedEmptyCacheFallback.property.test.ts` and `server/src/routes/data.disabledFallback.property.test.ts` assert `posts` equals the current non-empty dataset. Update the expectation to the new (empty) dataset; the `source: "fallback"` envelope assertions stay as-is.

These updates are part of the fix, not regressions: the old assertions encode the defect.

## Testing Strategy

### Validation Approach

Two phases: first surface counterexamples that demonstrate the bug on the unfixed code, then verify the fix is correct and that genuine-post and non-Tweets behavior is preserved.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix, and confirm the root-cause analysis. If a check fails to reproduce, re-hypothesize.

**Test Plan**: Write tests that (a) inspect the fallback dataset for placeholder counts and non-x.com `sourceUrl` hosts, and (b) drive `adaptRawResponse` with a representative vendor response and inspect the host of the resulting back-link. Run them on the UNFIXED code to observe failures.

**Test Cases**:
1. **Fallback host test**: Assert every served fallback post's `sourceUrl` is on the `x.com` host (will fail on unfixed code — points to mass.gov, wbur.org, etc.).
2. **Fallback real-counts test**: Assert no served fallback post carries placeholder engagement counts (will fail on unfixed code — counts are documented placeholders).
3. **Live back-link host test**: Feed `adaptRawResponse` a vendor post for a known handle and assert the mapped `url`/`sourceUrl` host is `x.com` (will fail on unfixed code — builds `twitter.com`).
4. **Empty-feed render edge case**: With live posting disabled, assert `GET /api/tweets` returns `source: "fallback"` and the client renders the empty-state while still showing the origin indicator and notice (may fail on unfixed code, which renders non-genuine posts).

**Expected Counterexamples**:
- Fallback `sourceUrl` hosts are news/government/campaign domains, not `x.com`.
- Fallback `likes`/`reposts` are hardcoded placeholders.
- Live adapter emits a `twitter.com` back-link.
- Possible causes confirmed: placeholder counts in the dataset, non-x.com `sourceUrl`s in the dataset, and the literal `twitter.com` host in `adaptRawResponse`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed system produces the expected behavior (genuine x.com post with real counts, or exclusion).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := servedFeed_fixed(input)
  ASSERT every displayed post has hostOf(post.sourceUrl) == "x.com"
         AND engagementCountsAreReal(post)
  ASSERT non-genuine posts are excluded (not displayed)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold — genuine live/cache posts with real counts and any non-Tweets interaction — the fixed system produces the same result as the original system.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT servedFeed_original(input) = servedFeed_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation because:
- It generates many post/state combinations automatically across the input domain.
- It catches edge cases manual unit tests might miss (e.g. mixed followed/unfollowed ordering, tab membership across all four tabs).
- It provides strong guarantees that genuine-post and non-Tweets behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe current behavior on the unfixed code for genuine live posts (via the existing provider property tests) and non-Tweets endpoints, then assert that behavior is retained after the fix.

**Test Cases**:
1. **Live real-count preservation**: Observe that a mapped live post retains its `public_metrics` counts; assert this still holds after the fix (counts are never overwritten).
2. **Live filtering preservation**: Observe that non-public, under-attributed, or unmatched-handle raw posts are dropped by `mapRawPosts`; assert this is unchanged after the host-only edit.
3. **Tabs/ordering/context preservation**: Observe `filterByTab` and `orderByFollowed` behavior for a set of displayed posts; assert unchanged after the fix.
4. **Non-Tweets preservation**: Observe `/api/candidates`, `/api/issues`, `/api/causes`, `/api/connect`, `/api/election`, `/api/quiz` responses; assert byte-for-byte unchanged after the fix.

### Unit Tests

- `adaptRawResponse` maps a vendor post to a `Tweet` whose `sourceUrl` is `https://x.com/{handle}/status/{id}` and whose `likes`/`reposts` come from `public_metrics`.
- The fallback dataset contains only genuine records (currently none): any present record has an `x.com` `sourceUrl` host and real counts.
- `GET /api/tweets` with live posting disabled returns `{ posts: [], source: "fallback" }`, and the empty feed renders the existing empty-state plus origin indicator and notice.

### Property-Based Tests

- For any mapped live post, `sourceUrl` host is `x.com` and engagement counts equal the source `public_metrics` values (fix + real-count preservation).
- For any served fallback post, its `sourceUrl` host is `x.com` and its counts are real (genuineness invariant; vacuously true while the dataset is empty).
- For any set of displayed posts and any follow set, `filterByTab` + `orderByFollowed` produce the same partition and ordering as before (preservation).
- Update existing Property 20 and the two fallback-equality route properties to the new expected (empty, genuine-only) contract.

### Integration Tests

- Full `GET /api/tweets` flow with live posting enabled and a stubbed vendor response: posts are served with `source: "live"` and `x.com` back-links and real counts.
- Live posting disabled: `source: "fallback"`, empty posts, origin indicator shows "Fallback · live posting off", notice present.
- Context-switch flow: switching among the four tabs and toggling followed candidates reorders/filters displayed posts correctly; non-Tweets pages render unchanged.
