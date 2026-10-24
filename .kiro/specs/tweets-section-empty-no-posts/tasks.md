# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Empty Fallback Serves Zero Posts
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (the fallback branch serves an empty dataset, so every tab shows the empty state)
  - **Scoped PBT Approach**: This is a deterministic data gap, so scope the property to the concrete failing configuration: live posting disabled (`isLivePostsEnabled()` false) resolving to the fallback branch with `tweets = []`
  - Exercise `resolveTweets()` / `GET /api/tweets` with live posting disabled (`isBugCondition` true) and assert the served envelope is non-empty: `source === "fallback"` with `posts.length >= 1` and at least one post whose `tabs` include `"recent"` (from Bug Condition `isBugCondition(input)` in design)
  - The test assertions should match the Expected Behavior from design Property 1: every served record has non-empty `text`/`authorName`/`authorHandle`/`sourceUrl`, a `sourceUrl` whose host is `x.com`, real finite non-negative integer `likes`/`reposts`, an `authorHandle` matching a candidate via `normalizeHandle`, and a `candidateId` matching a real candidate in `candidates.ts`
  - Optionally render `TweetsPage` with a `{ posts: [], source: "fallback" }` envelope and assert "No posts in this tab yet." appears on the Recent tab, to pin the client symptom
  - Run test on UNFIXED code (`tweets = []` in `server/src/domain/tweets.ts`)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the empty fallback dataset leaves the section empty)
  - Document counterexamples found to understand root cause (e.g., "resolveTweets() on the fallback branch returns posts: [] so the Recent tab renders the empty state")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Tabs, Ordering, Context, Origin Indicator, and Genuine-Only Guarantee Unchanged
  - **IMPORTANT**: Follow observation-first methodology - reuse the EXISTING property tests rather than duplicating them
  - Observe behavior on UNFIXED code for inputs where `isBugCondition` is false (live/cache branches and the client rendering): the four tabs partition by `filterByTab` membership, `orderByFollowed` floats followed candidates first (stable within group), "Added context" blocks render on the Needs Context tab, and the origin indicator renders the Live / Cached / Fallback label per source
  - Confirm the existing client preservation test `client/src/pages/genuineXPosts.preservation.property.test.tsx` (Property 2: tabs/ordering/context and origin indicator) PASSES on the unfixed code
  - Confirm the existing server dataset property test `server/src/domain/tweets.property.test.ts` (Property 20: dataset 0..50 records, every `sourceUrl` host is `x.com`, real finite non-negative integer `likes`/`reposts`) PASSES on the unfixed code
  - These property-based tests generate many envelopes and follow sets automatically, giving strong guarantees that tab filtering, ordering, context rendering, the origin indicator, and the genuine-only guarantee are unchanged
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms the baseline behavior to preserve)
  - Mark task complete when the existing preservation tests are confirmed written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix for empty Tweets fallback dataset (populate with genuine, verified x.com posts)

  - [ ] 3.1 Populate the fallback dataset with genuine, verified x.com posts
    - In `server/src/domain/tweets.ts`, replace the empty `[]` literal with an array of real, publicly published x.com posts for the known candidates (`maura-healey` / `@maura_healey`, `mike-minogue` / `@minogueforma`), each a `Tweet` record with `id`, `candidateId`, `authorName`, `authorHandle`, `text`, `date` (ISO), `likes`, `reposts`, `tabs`, and `sourceUrl`
    - Verify every `sourceUrl` resolves to that exact post on the `x.com` host (e.g. `https://x.com/<handle>/status/<id>`), so `new URL(sourceUrl).host === "x.com"`
    - Record only real engagement counts: `likes` and `reposts` are the actual finite, non-negative integer counts reported by the source at verification time - no placeholder or fabricated values
    - Attribute each record to a real candidate: its `authorHandle` matches a candidate's `handle` under `normalizeHandle` (case-insensitive, `@`-insensitive) and its `candidateId` equals that candidate's `id` in `candidates.ts`
    - Assign `tabs` as a non-empty subset of `["recent", "notable", "needsContext", "interactions"]` with at least one record in `recent`; records placed in `needsContext` carry a neutral editorial `context` block that does not endorse, rank, or recommend any position
    - Keep the dataset between 1 and 50 records and update the module doc comment to reflect that verified records are now present and to reference `DATA_SOURCES.md`, without relaxing any genuine-only verification wording
    - Do NOT modify `resolveTweets()`, `fallbackResponse()`, the provider pipeline, `filterByTab`, `orderByFollowed`, `PostsStatus`, or any non-Tweets route/section
    - _Bug_Condition: isBugCondition(input) where resolvesToFallback AND length(fallbackDataset) = 0 (from design)_
    - _Expected_Behavior: fallback branch serves a non-empty genuine dataset so at least Recent is populated, every record genuine per Property 1 (expectedBehavior from design)_
    - _Preservation: Preservation Requirements from design - live/cache branches, decision tree, filterByTab, orderByFollowed, context blocks, origin indicator, genuine-only guarantee, non-Tweets sections all unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Empty Fallback Serves Zero Posts
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior; when it passes, it confirms the fallback branch now serves a non-empty genuine dataset and the Recent tab is populated
    - Run the bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms the bug is fixed - the section is no longer empty)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Tabs, Ordering, Context, Origin Indicator, and Genuine-Only Guarantee Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run `client/src/pages/genuineXPosts.preservation.property.test.tsx` (Property 2) and `server/src/domain/tweets.property.test.ts` (Property 20)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - tab filtering, ordering, context, origin indicator, and the genuine-only guarantee / dataset bounds are unchanged with the populated dataset)
    - Confirm all tests still pass after the fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run the full server and client test suites and ensure all tests pass
  - Confirm the bug condition exploration test (Property 1) passes and the preservation tests (Property 2, Property 20) still pass
  - Ask the user if questions arise.
