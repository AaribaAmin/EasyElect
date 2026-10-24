# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Only genuine x.com posts are displayed
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (see Exploratory Bug Condition Checking in design)
  - **Scoped PBT Approach**: For the deterministic parts (fixed fallback dataset, fixed `twitter.com` literal) scope the property to the concrete failing records/response; for the live adapter, generate handles/ids and assert the mapped back-link host
  - Encode `isBugCondition(input)` from the design: a served post is buggy when it is displayed but is NOT a genuine x.com post — its `sourceUrl` host is not `x.com`, OR its `likes`/`reposts` are not the real counts from the source
  - Test case (a) - Fallback host: for each record served from the fallback dataset (`tweets` in `server/src/domain/tweets.ts`), assert `hostOf(post.sourceUrl) === "x.com"` — expect FAIL (hosts are mass.gov, wbur.org, bostonglobe.com, nbcboston.com, cbsnews.com, yahoo.com, campaign site)
  - Test case (b) - Fallback real counts: assert no served fallback post carries placeholder engagement counts — expect FAIL (the dataset documents its `likes`/`reposts` as display-only placeholders)
  - Test case (c) - Live back-link host: drive `adaptRawResponse` in `server/src/posts/provider.ts` with a representative vendor response for a known handle and assert `hostOf(mapped.url) === "x.com"` — expect FAIL (builds `https://twitter.com/${handle}/status/${id}`)
  - Test assertions should match the Expected Behavior / Property 1 from design (x.com back-link AND real counts, else excluded)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (non-x.com fallback hosts, placeholder fallback counts, `twitter.com` live back-link) to confirm the root-cause analysis
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Genuine posts and non-Tweets behavior unchanged
  - **IMPORTANT**: Follow observation-first methodology — run the UNFIXED code first and record actual outputs, then assert those outputs
  - Encode `NOT isBugCondition(input)`: genuine live/cache posts with real counts, and any non-Tweets interaction
  - Observe (a) - Live real-count preservation: a post mapped by `adaptRawResponse` / `mapRawPost` retains its `public_metrics` `likes`/`reposts` values; capture and assert those exact counts are preserved (Req 3.1)
  - Observe (b) - Live filtering preservation: non-public, under-attributed, or unmatched-handle raw posts are dropped by `mapRawPosts`; assert the same posts are dropped (Req 3.5)
  - Observe (c) - Tabs/ordering/context preservation: for a generated set of displayed posts and a follow set, `filterByTab` and `orderByFollowed` (in `TweetsPage.tsx`) produce the same tab partition and ordering, and "Added context" blocks render for the same posts (Req 3.2)
  - Observe (d) - Origin indicator & notice: views rendering live content still show the Live/Cached/Fallback indicator (`PostsStatus.tsx`) and the usage/attribution notice (Req 3.3)
  - Observe (e) - Non-Tweets preservation: `/api/candidates`, `/api/issues`, `/api/causes`, `/api/connect`, `/api/election`, `/api/quiz` responses are byte-for-byte unchanged (Req 3.4)
  - Write property-based tests capturing these observed behavior patterns across generated inputs for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for non-genuine posts in the Tweets feed (fabricated counts and non-x.com origins)

  - [x] 3.1 Change the live back-link host to x.com in `adaptRawResponse`
    - In `server/src/posts/provider.ts`, change the single back-link template from the `twitter.com` host to the `x.com` host
    - Before: `url: handle && id ? \`https://twitter.com/${handle}/status/${id}\` : undefined`
    - After: `url: handle && id ? \`https://x.com/${handle}/status/${id}\` : undefined`
    - Leave the search endpoint, auth scheme, response adaptation, and the public-only/attribution/handle-match pipeline untouched
    - _Bug_Condition: isBugCondition(input) where hostOf(input.post.sourceUrl) != "x.com" (live half)_
    - _Expected_Behavior: expectedBehavior(result) builds sourceUrl on the x.com host (Req 2.4)_
    - _Preservation: live real-count mapping and public-only/attribution/handle-match filtering unchanged (Req 3.1, 3.5)_
    - _Requirements: 1.4, 2.4_

  - [x] 3.2 Reduce the fallback dataset to genuine x.com posts only
    - In `server/src/domain/tweets.ts`, reduce the exported `tweets` array to only genuine x.com posts with real engagement counts and `x.com` back-links
    - None of the current records qualify (placeholder counts, non-x.com `sourceUrl`, paraphrased text), so the array becomes empty: `export const tweets: Tweet[] = [];`
    - Do not change the `Tweet`/`TweetsResponse`/`PostsSource` types or the `fallbackResponse()` / `resolveTweets()` decision tree — an empty fallback yields `{ posts: [], source: "fallback" }`
    - _Bug_Condition: isBugCondition(input) where fallback post has placeholder counts OR non-x.com sourceUrl_
    - _Expected_Behavior: expectedBehavior(result) excludes any post not verifiable as a genuine x.com post (Req 2.1, 2.2, 2.3)_
    - _Preservation: envelope, source values, and the resolveTweets decision tree unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [x] 3.3 Update the fallback dataset header documentation
    - Rewrite the file header in `server/src/domain/tweets.ts` to state the dataset contains only genuine, verifiable x.com posts with real engagement counts and `x.com` back-links, and is empty whenever no such verified records exist
    - Remove the "display-only placeholders" language, which described the defect
    - _Bug_Condition: isBugCondition(input) — header formerly licensed placeholder counts_
    - _Expected_Behavior: documentation reflects genuine-only, real-count contract_
    - _Preservation: documentation-only change; no runtime behavior affected_
    - _Requirements: 2.1, 2.3_

  - [x] 3.4 Update existing property tests that encode the old buggy contract
    - `server/src/domain/tweets.property.test.ts` (Property 20): change the "between 1 and 50 records" assertion to allow an empty dataset and, for any record present, require an `x.com` `sourceUrl` host and real engagement counts
    - `server/src/routes/data.tweetsFailedEmptyCacheFallback.property.test.ts`: change the `posts` expectation to the new (empty) dataset; keep the `source: "fallback"` envelope assertions as-is
    - `server/src/routes/data.disabledFallback.property.test.ts`: change the `posts` expectation to the new (empty) dataset; keep the `source: "fallback"` envelope assertions as-is
    - These updates replace assertions that encoded the defect with the new expected (empty, genuine-only) contract
    - _Bug_Condition: old tests asserted the buggy non-empty placeholder/non-x.com contract_
    - _Expected_Behavior: tests assert the genuine-only, empty-when-unverified contract_
    - _Preservation: `source: "fallback"` envelope assertions unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Only genuine x.com posts are displayed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior; when it passes it confirms genuine-only display (x.com back-link AND real counts, else excluded)
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Genuine posts and non-Tweets behavior unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in live real-count display, tabs/ordering/context, origin indicator and notice, live filtering, and non-Tweets sections)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full server and client test suites and ensure all tests pass, including the updated Property 20 and the two fallback-equality route properties
  - Ensure all tests pass, ask the user if questions arise
