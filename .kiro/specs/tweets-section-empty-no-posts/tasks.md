# Implementation Plan: News Section

## Overview

Minimal/surgical repurposing of the Tweets section into a curated candidate News feed. Tasks 1 and 2 of the prior plan (a bug-condition exploration test and a preservation baseline) were executed against the OLD x.com-post design; because the data model has fundamentally changed, this is a fresh task list for the news feed. The server envelope `{ posts, source }`, the cache -> live -> fallback decision tree in `resolveTweets()`, `fallbackResponse()`, and the `PostsStatus` origin indicator are preserved; only the item model and the fallback data change. All tasks are coding-only. Article URLs must be real and resolvable -- do not fabricate headlines, outlets, dates, or URLs.

## Tasks

- [x] 1. Define the News_Item domain type and mirror it client-side
  - [x] 1.1 Define the News item type in `server/src/domain/types.ts`
    - Replace the x.com `Tweet` usage for this section with `{ id: string; candidateIds: string[]; title: string; outlet: string; url: string; date: string; tabs: TweetTab[]; context?: Explain }`
    - Keep the `TweetTab` union ids (`"recent" | "notable" | "needsContext" | "interactions"`) and keep `TweetsResponse` as `{ posts: News_Item[]; source: PostsSource }`
    - _Requirements: 2.3, 2.4, 3.1_
  - [x] 1.2 Mirror the News item type in `client/src/types/domain.ts`
    - Declare the identical item shape so server and client stay in sync; keep `TweetsResponse` envelope unchanged
    - _Requirements: 2.3, 3.1_
  - [x] 1.3 Update `client/src/lib/shape.ts` validators to the News item shape
    - Validate `id`/`title`/`outlet`/`url`/`date` are non-empty strings, `candidateIds` is a non-empty string array, `tabs` members are in the `TweetTab` union, optional `context` is a valid `Explain`; keep the discriminated `ShapeResult` and envelope `source` union check
    - Drop the `authorHandle`/`likes`/`reposts`/`text`/single-`candidateId` checks
    - _Requirements: 2.3, 2.4, 3.1_
  - [x]* 1.4 Write unit tests for the shape validators
    - Cover acceptance of a valid item and rejection of missing/renamed/wrong-typed fields and out-of-union `source`
    - _Requirements: 2.3, 2.4_

- [x] 2. Adapt pure filters and ordering to candidateIds any-of + date ordering
  - [x] 2.1 Adapt `resolveParty` and `applyFeedFilters` in `client/src/lib/feedFilter.ts`
    - `resolveParty(item, partyIndex)` resolves via `item.candidateIds.some(id => partyIndex.has(id))`; party filter keeps an item iff ANY id resolves to the selected party; following-only keeps an item iff ANY id is in the followed set; empty follow set yields `[]`, not an error; keep functions pure and React-free, mutating no inputs
    - _Requirements: 2.7, 3.3, 3.4_
  - [x] 2.2 Adapt `orderByFollowed` in `client/src/lib/feedFilter.ts`
    - Float an item ahead iff ANY of `candidateIds` is followed (stable partition); within each group order most-recent-first by `date`; return a fresh array, mutate nothing
    - _Requirements: 2.8, 3.4_
  - [x]* 2.3 Write property tests for the any-of filters and ordering
    - **Property 4: Any-of filters and ordering** -- party/follow keep-by-any-of, empty follow set yields empty feed, followed-first + most-recent-first ordering, purity
    - **Validates: Requirements 2.7, 2.8, 3.4**

- [x] 3. Update the client rendering
  - [x] 3.1 Update tab labels in `client/src/pages/TweetsPage.tsx`
    - Label the four tabs "Recent News" / "Notable News" / "Needs Context" / "Interactions" (keep tab ids); keep the party `<select>`, the follow toggle, empty-state branches, and `PostsStatus` wiring
    - _Requirements: 2.6, 3.2, 3.3_
  - [x] 3.2 Update `client/src/features/tweets/TweetCard.tsx` to render News items
    - Render `title`, `outlet`, formatted `date`, and a link to `url`; render the neutral `context` block on the Needs Context tab; drop the author/handle/avatar, `likes`/`reposts`, `inReplyTo`, and `text` rendering
    - _Requirements: 2.6, 3.2_
  - [x]* 3.3 Write unit tests for `TweetCard` News rendering
    - Assert title/outlet/date/url render and that `context` shows only on the Needs Context tab
    - _Requirements: 2.6_

- [x] 4. Populate the curated News_Dataset in `server/src/domain/tweets.ts`
  - Keep the exported name `tweets` (now `News_Item[]`) so `data.ts`'s import is untouched; update the module doc comment to describe the verified-news dataset and reference `DATA_SOURCES.md`
  - Add real, VERIFIED news items covering candidates across the ballot (at least the well-covered races -- Governor Healey/Minogue -- plus any others with findable coverage); each item has a resolvable `url`, a real `outlet`, a real headline `title`, and a valid ISO 8601 `date`
  - Include at least one item with `"recent"` in `tabs`, at least one multi-candidate item (`candidateIds.length >= 2`) tagged `"interactions"`, and at least one item carrying a neutral `context` block tagged `"needsContext"`
  - Candidates with no verifiable coverage get nothing (no placeholder, no fabrication); keep the dataset within 0..100 records
  - NOTE: article URLs must be real and resolvable -- use web search/fetch to find and verify genuine articles, and do NOT fabricate headlines, outlets, dates, or URLs; if coverage cannot be verified for a candidate, leave them out
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.5_

- [x] 5. Update and replace the property and unit tests
  - [x] 5.1 Rewrite the dataset property test (`server/src/domain/tweets.property.test.ts`)
    - **Property 1: Bug Condition -> fixed** and Verified_Source -- `url` parses as `http`/`https`, non-empty `title`/`outlet`/`url`/`date` (valid ISO 8601), `candidateIds` non-empty + unique + all resolve to real candidates, dataset size 0..100; serve non-empty on fallback with at least one `"recent"` item
    - Remove the x.com-host and `likes`/`reposts` assertions
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.5**
  - [x] 5.2 Update the bug-condition test (`server/src/routes/data.emptyFallbackBugCondition.property.test.ts`)
    - Assert the fallback branch serves a non-empty verified `News_Dataset` (Recent News populated) instead of the empty-dataset bug condition
    - **Validates: Requirements 2.1, 2.2, 3.1**
  - [x] 5.3 Adapt the client preservation test to the News item shape + any-of
    - **Property 2: Preservation** and **Property 3: Interactions tab consistency** -- tab membership via `filterByTab`, any-of ordering, party/follow filters, origin indicator unchanged; interactions iff `"interactions" in tabs` AND `candidateIds.length >= 2`; retire/rewrite the handle-based `genuineXPosts.*` exploration and `likes`/`reposts` assertions
    - **Validates: Requirements 2.6, 3.2, 3.3, 3.4**
  - [x] 5.4 Retire or reduce the x.com provider tests (`server/src/posts/provider.*`)
    - Remove handle-based mapping assertions tied to the x.com post shape; keep only tests that verify the preserved cache -> live -> fallback decision tree
    - _Requirements: 3.1_

- [x] 6. Checkpoint -- Ensure all builds and tests pass
  - Run the server and client builds/typechecks and the full test suites; ensure all pass; confirm the News section is populated (Recent News shows items) and non-Tweets sections are unaffected. Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements (2.x / 3.x) and design properties for traceability.
- The checkpoint ensures incremental validation of the build and test suites.
- Property tests validate universal correctness properties; unit tests validate specific rendering and edge cases.
