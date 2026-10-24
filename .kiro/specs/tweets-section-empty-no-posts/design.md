# Tweets Section Empty — No Posts Bugfix Design

## Overview

The Tweets section renders no posts in any of its four tabs because the fallback posts dataset is empty. On the server, `resolveTweets()` in `server/src/routes/data.ts` walks a cache → live → fallback decision tree. When live posting is not configured (no `LIVE_POSTS_BEARER_TOKEN`), `isLivePostsEnabled()` returns `false` and the route immediately serves `fallbackResponse() = { posts: tweets, source: "fallback" }`. The fallback dataset `tweets` in `server/src/domain/tweets.ts` is `[]`, so every request under the common (no-credentials) configuration resolves to zero posts, and `TweetsPage` shows "No posts in this tab yet." on all four tabs.

The fix is narrow and additive: populate `tweets` with genuine, verified x.com posts that satisfy the existing genuine-only guarantee. Each record must be a real, publicly published x.com post whose `sourceUrl` resolves to that post on the `x.com` host, carry the real engagement counts reported by the source, carry an `authorHandle` that matches a known candidate via normalized handle, and carry a `candidateId` matching a real candidate in `candidates.ts`. The fix removes the emptiness by *supplying verified records*, not by relaxing verification — the genuine-only guarantee and its property tests stay in force. All other Tweets behavior (the live-fetch pipeline, `filterByTab` tab membership, followed-candidate ordering, the origin indicator, the "Added context" blocks) and every non-Tweets section are untouched.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a request resolves to the fallback branch while the fallback dataset is empty, so the Tweets section serves zero posts and every tab shows the empty state.
- **Property (P)**: The desired behavior for the bug condition — the fallback branch serves a non-empty dataset of genuine x.com posts, so at least the Recent tab displays one or more posts instead of the empty state.
- **Preservation**: The behavior that must remain unchanged by the fix — the live-fetch pipeline, `filterByTab` tab membership, `orderByFollowed` followed-first ordering, the origin indicator (Live / Cached / Fallback), the "Added context" blocks, the genuine-only guarantee and its property tests, and every non-Tweets section.
- **Fallback_Posts_Dataset**: The `tweets: Tweet[]` array exported from `server/src/domain/tweets.ts`, served verbatim by `fallbackResponse()` when the route resolves to the fallback branch.
- **`resolveTweets()`**: The function in `server/src/routes/data.ts` that resolves the `TweetsResponse` envelope via the cache → live → fallback decision tree. It serves `fallbackResponse()` when live posting is disabled, or when a live fetch fails with an empty cache.
- **`isLivePostsEnabled()`**: The predicate in `server/src/posts/provider.ts` that reports whether `LIVE_POSTS_BEARER_TOKEN` is present and non-empty. When it returns `false`, `resolveTweets()` takes the fallback branch with no network call.
- **`normalizeHandle()`**: The function in `server/src/posts/provider.ts` that lowercases a handle and strips at most one leading `@`, used to match an `authorHandle` to a candidate's `handle`.
- **`filterByTab()`**: The pure function in `client/src/lib/tweetFilter.ts` that returns the posts whose `tabs` array contains a given tab, preserving input order.
- **`orderByFollowed()`**: The in-component helper in `client/src/pages/TweetsPage.tsx` that stably floats posts from followed candidates to the front of the list.
- **Genuine-only guarantee**: The invariant (from the prior `tweets-section-genuine-x-posts` fix) that every fallback record is a real, verifiable x.com post — non-empty fields, `sourceUrl` host of `x.com`, real (finite, non-negative integer) engagement counts, dataset size 0..50 — enforced by `server/src/domain/tweets.property.test.ts`.

## Bug Details

### Bug Condition

The bug manifests when a `GET /api/tweets` request resolves to the fallback branch of `resolveTweets()` while the `Fallback_Posts_Dataset` (`tweets`) is empty. This is the default configuration: with no `LIVE_POSTS_BEARER_TOKEN`, `isLivePostsEnabled()` returns `false`, the route serves `{ posts: [], source: "fallback" }`, and `TweetsPage` applies `filterByTab` to an empty list for every tab — so each of Recent, Notable, Needs Context, and Interactions shows "No posts in this tab yet." The same empty result is served when a live fetch fails (timeout / network / non-success) with an empty cache.

The function is not misbehaving in its control flow — the fallback branch is correct. The defect is in the *data*: the dataset that the fallback branch is required to serve has no records, so there is nothing to display.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type TweetsRequestContext
         { livePostsEnabled: boolean,
           liveFetchOutcome: "ok" | "rateLimited" | "failed" | "n/a",
           cacheNonEmpty: boolean,
           fallbackDataset: Tweet[] }
  OUTPUT: boolean

  // The request resolves to the fallback branch of resolveTweets()
  resolvesToFallback :=
       (input.livePostsEnabled = false)
    OR (input.livePostsEnabled = true
        AND input.liveFetchOutcome = "failed"
        AND input.cacheNonEmpty = false)

  RETURN resolvesToFallback
         AND length(input.fallbackDataset) = 0
END FUNCTION
```

### Examples

- **No credentials (default), Recent tab**: `livePostsEnabled = false`, `fallbackDataset = []`. Expected: the Recent tab shows at least one genuine post. Actual (bug): "No posts in this tab yet."
- **No credentials, every tab**: `livePostsEnabled = false`, `fallbackDataset = []`. Expected: the served posts partition across the four tabs by `tabs` membership so populated tabs show posts. Actual (bug): all four tabs empty.
- **Live fetch fails, empty cache**: `livePostsEnabled = true`, `liveFetchOutcome = "failed"`, `cacheNonEmpty = false`, `fallbackDataset = []`. Expected: the genuine fallback posts are served so the section is populated. Actual (bug): zero posts served, section empty.
- **Edge case — populated fallback (post-fix)**: `livePostsEnabled = false`, `fallbackDataset = [genuine x.com posts]`. `isBugCondition` is `false` because the dataset is non-empty; the section displays the genuine posts. This is the target state.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The live-fetch pipeline in `server/src/posts/provider.ts` (`isLivePostsEnabled`, `fetchLivePosts`, `mapRawPost`/`mapRawPosts`, public-only / full-attribution / handle-match filtering) must behave exactly as before; a live-returned genuine post still displays with its real `likes`/`reposts`.
- The cache → live → fallback decision tree in `resolveTweets()` is unchanged; only the data served on the fallback branch changes.
- The four tabs and tab-membership filtering via `filterByTab` behave exactly as before.
- `orderByFollowed` stably floats followed candidates to the front, unchanged.
- The "Added context" blocks render for posts that carry a `context` block on the Needs Context tab, unchanged.
- The origin indicator (Live / Cached / Fallback) renders for the served source, unchanged.
- The genuine-only guarantee and its property tests continue to hold: the dataset holds 0..50 records, every record's `sourceUrl` resolves to the `x.com` host, and no record carries placeholder or fabricated engagement counts.
- Every non-Tweets section (candidates, issues, causes, connect, election, quiz) behaves exactly as before.

**Scope:**
All inputs where `isBugCondition` is `false` must be completely unaffected by this fix. This includes:
- Requests that resolve to the live branch (`source: "live"`) or the cache branch (`source: "cache"`).
- Requests that resolve to the fallback branch when the dataset is already non-empty (the post-fix steady state) — these display the genuine posts the fix supplies.
- All client-side rendering logic: tab filtering, followed-first ordering, context blocks, origin indicator.
- All non-Tweets API routes and UI sections.

**Note:** The actual expected correct behavior for the bug condition is defined in the Correctness Properties section (Property 1). This section records what must NOT change.

## Hypothesized Root Cause

Based on the bug analysis, the cause is a single, well-understood data gap rather than a logic error:

1. **Empty fallback dataset (confirmed root cause)**: `server/src/domain/tweets.ts` exports `export const tweets: Tweet[] = []`. The accompanying doc comment states the array is intentionally empty because no verified x.com records existed when the genuine-only fix (`tweets-section-genuine-x-posts`) landed. The fallback branch of `resolveTweets()` serves this array verbatim via `fallbackResponse()`, so with live posting disabled the section always serves zero posts.

2. **Default no-credentials configuration exercises the fallback branch**: `isLivePostsEnabled()` returns `false` when `LIVE_POSTS_BEARER_TOKEN` is absent, which is the common local/default configuration. This routes essentially every request to the empty fallback.

3. **Not a control-flow defect**: The decision tree, `filterByTab`, `orderByFollowed`, and the origin indicator are all correct. They faithfully render an empty dataset as an empty section. No change to any of them is required or desirable.

4. **Not a verification-strictness defect**: The genuine-only guarantee is correct and must stay. The gap is simply that no genuine records had been added yet. The fix closes the gap by adding verified records, not by weakening verification.

## Correctness Properties

Property 1: Bug Condition - Populated genuine fallback displays posts

_For any_ input where the bug condition holds (isBugCondition returns true — a request resolves to the fallback branch while the dataset is empty), the fixed system SHALL serve a non-empty `Fallback_Posts_Dataset` of genuine x.com posts such that at least the Recent tab displays one or more posts instead of the empty state, and every served record satisfies the genuine-only guarantee: non-empty `text`/`authorName`/`authorHandle`/`sourceUrl`, a `sourceUrl` whose host is `x.com`, real (finite, non-negative integer) `likes`/`reposts`, an `authorHandle` that matches a known candidate via `normalizeHandle`, and a `candidateId` that matches a real candidate in `candidates.ts`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-fallback and non-Tweets behavior unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns false — the request resolves to the live or cache branch, or the fallback dataset is already non-empty, or the input exercises a non-Tweets section), the fixed system SHALL produce the same result as the original system, preserving the live-fetch pipeline, the cache → live → fallback decision tree, `filterByTab` tab membership, `orderByFollowed` followed-first ordering, the "Added context" blocks, the origin indicator (Live / Cached / Fallback), and every non-Tweets section.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**

Property 3: Preservation - Genuine-only guarantee and dataset bounds unchanged

_For any_ execution, the fixed `Fallback_Posts_Dataset` SHALL continue to satisfy the genuine-only guarantee and its property tests: the dataset holds between 0 and 50 records, every record's `sourceUrl` resolves to the `x.com` host, and no record carries placeholder or fabricated engagement counts.

**Validates: Requirements 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `server/src/domain/tweets.ts`

**Export**: `tweets: Tweet[]`

**Specific Changes**:
1. **Populate the dataset with genuine, verified x.com posts**: Replace the empty `[]` literal with an array of real, publicly published x.com posts for the known candidates (`maura-healey` / `@maura_healey`, `mike-minogue` / `@minogueforma`). Each post is a `Tweet` record carrying `id`, `candidateId`, `authorName`, `authorHandle`, `text`, `date` (ISO), `likes`, `reposts`, `tabs`, and `sourceUrl`.

2. **Verify each `sourceUrl` against the live post on `x.com`**: Every `sourceUrl` must resolve to that exact post on the `x.com` host (e.g. `https://x.com/<handle>/status/<id>`), so `new URL(sourceUrl).host === "x.com"`.

3. **Record real engagement counts only**: `likes` and `reposts` must be the actual counts reported by the source at verification time — finite, non-negative integers. No placeholder or fabricated values.

4. **Attribute to a real candidate via normalized handle**: Each record's `authorHandle` must match a candidate's `handle` under `normalizeHandle` (case-insensitive, `@`-insensitive), and its `candidateId` must equal that candidate's `id` in `candidates.ts`.

5. **Assign tab membership so at least Recent is populated**: Each record's `tabs` must be a non-empty subset of `["recent", "notable", "needsContext", "interactions"]`, with at least one record in `recent` so the default tab is non-empty. Records placed in `needsContext` should carry a neutral editorial `context` block (per the genuine-only guarantee, context must not endorse, rank, or recommend any position).

6. **Keep the dataset within bounds and update the doc comment**: Keep the total between 1 and 50 records, and update the module doc comment to reflect that verified records are now present and to reference `DATA_SOURCES.md` for the verification process. Do not relax any verification wording — the genuine-only guarantee remains.

**Non-changes (explicit):** `resolveTweets()`, `fallbackResponse()`, the provider pipeline, `filterByTab`, `orderByFollowed`, `PostsStatus`, and all non-Tweets routes/sections are not modified.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on the unfixed code (the empty-fallback section), then verify the fix populates the section with genuine posts while preserving every other behavior and the genuine-only guarantee.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis (empty fallback dataset served on the fallback branch). If refuted, re-hypothesize.

**Test Plan**: Exercise `resolveTweets()` / `GET /api/tweets` with live posting disabled and assert on the served envelope and on the rendered section. Run these against the UNFIXED code to observe the empty result and confirm the cause is the empty dataset, not the control flow.

**Test Cases**:
1. **Fallback envelope is empty (server)**: With `isLivePostsEnabled()` false, assert `resolveTweets()` returns `{ posts: [], source: "fallback" }` (will show zero posts on unfixed code).
2. **Recent tab empty state (client)**: Render `TweetsPage` with a `{ posts: [], source: "fallback" }` envelope and assert "No posts in this tab yet." appears on the default Recent tab (will fail to show posts on unfixed code).
3. **All four tabs empty (client)**: With the empty fallback envelope, switch through all four tabs and assert each shows the empty state (will fail to show posts on unfixed code).
4. **Live-failure-with-empty-cache fallback (server)**: With live posting enabled but the fetch outcome `failed` and an empty cache, assert the route resolves to `fallbackResponse()` and serves zero posts (edge case; empty on unfixed code).

**Expected Counterexamples**:
- The fallback envelope carries `posts: []`, so every tab renders the empty state.
- Root cause confirmed: the data served on the fallback branch is empty; the decision tree and client filtering are correct.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed system produces the expected behavior (a non-empty genuine dataset, Recent tab populated, every record genuine).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  response := resolveTweets_fixed(input)          // fallback branch
  ASSERT length(response.posts) >= 1
  ASSERT response.source = "fallback"
  ASSERT exists post IN response.posts WHERE "recent" IN post.tabs
  FOR ALL post IN response.posts DO
    ASSERT nonEmpty(post.text, post.authorName, post.authorHandle, post.sourceUrl)
    ASSERT host(post.sourceUrl) = "x.com"
    ASSERT isRealCount(post.likes) AND isRealCount(post.reposts)
    ASSERT exists cand IN candidates
           WHERE normalizeHandle(cand.handle) = normalizeHandle(post.authorHandle)
           AND cand.id = post.candidateId
  END FOR
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed system produces the same result as the original — the live/cache branches, the client rendering behavior, and all non-Tweets sections are unchanged.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT resolveTweets_original(input) = resolveTweets_fixed(input)
END FOR

// Client rendering is pure over the served envelope:
FOR ALL (posts, tab, following) DO
  ASSERT filterByTab_fixed(posts, tab) = filterByTab_original(posts, tab)
  ASSERT orderByFollowed_fixed(list, following) = orderByFollowed_original(list, following)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many envelopes and follow sets automatically across the input domain.
- It catches edge cases (empty follow set, overlapping tab membership, duplicate candidate ids) that manual unit tests might miss.
- It gives strong guarantees that tab filtering, ordering, context rendering, and the origin indicator are unchanged for all inputs.

The existing preservation property test `client/src/pages/genuineXPosts.preservation.property.test.tsx` (Property 2: tabs/ordering/context and the origin indicator) and the dataset property test `server/src/domain/tweets.property.test.ts` (Property 20: dataset 0..50, `x.com` host, real counts) already encode these guarantees and MUST continue to pass unchanged after the fix.

**Test Plan**: Observe behavior on the UNFIXED code first for the live/cache branches and the client rendering, then confirm the same behavior holds after the fix. Reuse the existing property tests rather than duplicating them.

**Test Cases**:
1. **Live branch preservation**: Observe that a genuine live-returned post displays with its real `likes`/`reposts`; verify this continues after the fix (live pipeline untouched).
2. **Tab/ordering/context preservation**: Observe that the four tabs partition by membership, followed candidates order first, and context blocks render on Needs Context; verify via the existing `genuineXPosts.preservation.property.test.tsx` after the fix.
3. **Origin indicator preservation**: Observe that the Live / Cached / Fallback indicator renders per source; verify via the existing preservation test after the fix.
4. **Genuine-only guarantee preservation**: Observe that `tweets.property.test.ts` holds (0..50, `x.com` host, real counts); verify it still passes after the dataset is populated.
5. **Non-Tweets sections preservation**: Observe candidates/issues/causes/connect/election/quiz responses; verify they are byte-for-byte unchanged after the fix.

### Unit Tests

- Assert the populated `tweets` dataset is non-empty and contains at least one record whose `tabs` include `recent`.
- Assert each record's `candidateId` resolves to a real candidate in `candidates.ts` and its `authorHandle` matches that candidate's `handle` under `normalizeHandle`.
- Assert `resolveTweets()` on the fallback branch serves the populated dataset with `source: "fallback"`.
- Assert the Recent tab of `TweetsPage` renders one or more posts (no empty state) given the populated fallback envelope.

### Property-Based Tests

- For every record in `tweets`: non-empty `text`/`authorName`/`authorHandle`/`sourceUrl`, `sourceUrl` host of `x.com`, real integer `likes`/`reposts`, and a candidate match by normalized handle and `candidateId` (extends/reuses Property 20).
- For generated envelopes and follow sets: `filterByTab` partitions by membership and `orderByFollowed` floats followed candidates first (reuses the existing Property 2 preservation test).
- For each source value: the origin indicator renders the corresponding Live / Cached / Fallback label (reuses the existing Property 2 preservation test).

### Integration Tests

- Full feed flow with live posting disabled: `GET /api/tweets` → `TweetsPage` renders the genuine fallback posts on the Recent tab with the Fallback origin indicator.
- Context-switching flow: switch through all four tabs and confirm each shows exactly the posts whose `tabs` include that tab, with "Added context" blocks on Needs Context.
- Live-then-fallback flow: with a `failed` live outcome and empty cache, confirm the section populates from the genuine fallback rather than showing the empty state.
