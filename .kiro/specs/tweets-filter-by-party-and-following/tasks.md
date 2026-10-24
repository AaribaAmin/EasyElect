# Implementation Plan: Tweets Filter by Party and Following

## Overview

This plan builds the feature bottom-up: the React-free pure module (`client/src/lib/feedFilter.ts`) and its property tests come first, so the filtering and party-resolution logic is proven before any UI depends on it. `orderByFollowed` is extracted out of `TweetsPage` into the pure module so it becomes importable and property-testable. Only then is `TweetsPage` rewired to fetch candidates, build the Party_Index, own the new filter state, render the controls, and choose the empty-state branch — reusing the extracted pure functions. Example/interaction tests and CSS round out the work. Every step is verifiable with the project's build (`tsc`/`vite build`) and test runner (`vitest --run`).

## Tasks

- [ ] 1. Create the pure feed-filter module with types and helpers
  - [ ] 1.1 Define module scaffolding, sentinel, and types in `client/src/lib/feedFilter.ts`
    - Create `client/src/lib/feedFilter.ts` importing only `Party`, `Tweet`, `TweetTab` from `../types/domain` and `filterByTab` from `./tweetFilter` (no React import, resides beside `tweetFilter.ts`)
    - Export the `ALL_PARTIES = "all" as const` sentinel, `PartySelection = Party | typeof ALL_PARTIES`, `PartyIndex = ReadonlyMap<string, Party>`, and the `FeedFilterInput` interface (`posts`, `tab`, `party`, `followingOnly`, `followedSet`, `partyIndex`) matching the design signatures
    - _Requirements: 7.2, 7.3_

  - [ ] 1.2 Implement `buildPartyIndex` and `resolveParty`
    - `buildPartyIndex(candidates)` returns a `Map<string, Party>` keyed by `id` (last write wins on duplicate ids)
    - `resolveParty(post, partyIndex)` returns `partyIndex.get(post.candidateId)`, yielding `undefined` for missing/null/absent `candidateId` (Unresolved_Post classification)
    - _Requirements: 2.1, 2.2_

  - [ ]* 1.3 Write property test for party resolution round-trip
    - **Property 6: Party resolution round-trips the index**
    - **Validates: Requirements 2.1, 2.2**
    - In `client/src/lib/feedFilter.test.ts`, generate candidate lists with distinct ids and assert `resolveParty` returns the recorded party for present ids and `undefined` for absent/empty/unknown ids
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 6: Party resolution round-trips the index`

  - [ ] 1.4 Implement `partyOptions`
    - Return each distinct party present among candidates exactly once, sorted ascending alphabetically; empty input yields `[]`
    - _Requirements: 1.1, 1.6_

  - [ ]* 1.5 Write property test for party options
    - **Property 8: Party options are the distinct parties, sorted, sentinel-prefixed**
    - **Validates: Requirements 1.1, 1.6**
    - Assert de-duplication, ascending alphabetical order, membership equality with the input's distinct parties, and `[]` for empty input
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 8: Party options are the distinct parties, sorted, sentinel-prefixed`

- [ ] 2. Implement the combined filter and extract follow-first ordering
  - [ ] 2.1 Implement `applyFeedFilters` in `client/src/lib/feedFilter.ts`
    - Compose three predicates over a fresh array: tab via `filterByTab`; party pass when `party === ALL_PARTIES` else `resolveParty(post) === party` (Unresolved_Posts excluded); following pass when `!followingOnly` else `followedSet.has(post.candidateId)`
    - Include a post only when it satisfies all three; preserve input relative order; return a newly allocated array and mutate none of `posts`, `followedSet`, or `partyIndex`; empty result (not error) when nothing qualifies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 1.3, 1.4, 1.5, 2.3, 2.4, 3.3, 3.4, 3.7, 4.1, 7.1, 7.4, 7.5, 7.6, 7.7_

  - [ ] 2.2 Extract `orderByFollowed` into the pure module
    - Move follow-first ordering out of `TweetsPage` into `client/src/lib/feedFilter.ts` as a React-free `orderByFollowed(list, followedSet)` that stably partitions followed-candidate posts ahead of the rest, preserving relative order within each group, returning a new array without mutation
    - _Requirements: 5.7_

  - [ ]* 2.3 Write property test — filtering is the intersection of the three predicates
    - **Property 1: Filtering is the intersection of the three predicates**
    - **Validates: Requirements 5.1, 1.4, 3.4**
    - Check `applyFeedFilters` against an independent reference predicate (`in-tab ∧ party-ok ∧ following-ok`) with generators that produce resolved and unresolved `candidateId`s
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 1: Filtering is the intersection of the three predicates`

  - [ ]* 2.4 Write property test — subsequence / faithful subset
    - **Property 2: Included posts preserve input order and are a faithful subset**
    - **Validates: Requirements 5.4, 7.4**
    - Assert every result element is an input element by identity, no fabrication, each at most once, and strictly increasing source indices
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 2: Included posts preserve input order and are a faithful subset`

  - [ ]* 2.5 Write property test — all-parties + following-off equals tab filtering alone
    - **Property 3: All-parties with following off equals tab filtering alone**
    - **Validates: Requirements 7.5, 1.3, 2.4, 5.2, 5.3**
    - Deep-equal `applyFeedFilters(party=ALL_PARTIES, followingOnly=false)` against `filterByTab(posts, tab)` in membership and order
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 3: All-parties with following off equals tab filtering alone`

  - [ ]* 2.6 Write property test — specific party excludes unresolved, keeps only that party
    - **Property 4: A specific party excludes unresolved posts and keeps only that party**
    - **Validates: Requirements 1.4, 1.5, 2.3, 5.5, 7.7**
    - For a generated specific party `P`, assert every result resolves to `P` and no Unresolved_Post survives; generators deliberately include unresolved ids
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 4: A specific party excludes unresolved posts and keeps only that party`

  - [ ]* 2.7 Write property test — following-only yields only followed, empty rather than error
    - **Property 5: Following-only yields only followed candidates, empty rather than error**
    - **Validates: Requirements 7.6, 3.4, 3.7, 4.1**
    - Assert every result's `candidateId ∈ followedSet` when enabled, and that empty/no-match returns `[]` without throwing
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 5: Following-only yields only followed candidates, empty rather than error`

  - [ ]* 2.8 Write property test — purity (deterministic, non-mutating)
    - **Property 7: The filter is pure — deterministic and non-mutating**
    - **Validates: Requirements 5.6, 7.1**
    - Snapshot inputs and assert deep-equality after the call, assert the returned array is a distinct reference, and assert two calls with the same inputs are equal
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 7: The filter is pure — deterministic and non-mutating`

  - [ ]* 2.9 Write property test — follow-first ordering is a stable partition
    - **Property 9: Follow-first ordering is a stable partition**
    - **Validates: Requirements 5.7**
    - For the extracted `orderByFollowed`, assert same-multiset output, followed-first partition, and within-group relative order preservation
    - Tag: `// Feature: tweets-filter-by-party-and-following, Property 9: Follow-first ordering is a stable partition`

  - [ ]* 2.10 Write smoke test confirming React-free import and signature
    - Import `feedFilter.ts` and invoke `applyFeedFilters` once with representative inputs to confirm it runs without importing any React component and accepts exactly the specified parameters
    - _Requirements: 7.2, 7.3_

- [ ] 3. Checkpoint - pure module complete and verified
  - Run `vitest --run` for `feedFilter.test.ts` and `tsc` build. Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Rewire `TweetsPage` to load candidates and own filter state
  - [ ] 4.1 Add candidates fetch and Party_Index derivation in `client/src/pages/TweetsPage.tsx`
    - Add a second `useValidatedApiData<Candidate[]>("/api/candidates", validateCandidateList)` fetch; derive the Party_Index with `buildPartyIndex` and the party options with `partyOptions` via `useMemo`
    - Treat a candidates fetch/validation failure as an empty Party_Index (every post Unresolved) so the tweets feed still renders and the party `<select>` offers only "All parties"
    - _Requirements: 1.6_

  - [ ] 4.2 Add filter state and replace inline ordering with the pure functions
    - Add `tab` (default `recent`), `selectedParty: PartySelection` (default `ALL_PARTIES`), and `followingOnly` (default `false`) via `useState`; derive `followedSet = new Set(following)` with `useMemo`
    - Remove the inline `orderByFollowed`; compute `filtered = applyFeedFilters({ posts, tab, party: selectedParty, followingOnly, followedSet, partyIndex })` then `ordered = followingOnly ? filtered : orderByFollowed(filtered, followedSet)`
    - _Requirements: 1.2, 3.2, 5.7, 5.8_

- [ ] 5. Add the filter controls and empty-state branching to `TweetsPage`
  - [ ] 5.1 Render the party `<select>` and following-only toggle
    - Add a toolbar with a party `<select>` mirroring `CandidatesList` (visually-hidden `label` + `htmlFor`, "All parties" sentinel option followed by `partyOptions`) and a labeled checkbox toggle for "Only candidates I follow", wiring both to state
    - _Requirements: 1.1, 1.3, 1.4, 1.7, 3.1, 3.3, 3.4, 3.5, 5.8, 6.2_

  - [ ] 5.2 Implement the four-branch empty-state decision and feed render
    - Render exactly one of: "you follow no one" with a `<Link to="/voting/candidates">`; "followed candidates have no posts"; "no posts match these filters" plus an actionable hint; or the `ordered` feed — never an empty-state message concurrently with any post; never reset `tab`/`selectedParty`/`followingOnly` across branches
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4, 3.6_

  - [ ]* 5.3 Write example/interaction tests for the page
    - Create `client/src/pages/TweetsPage.test.tsx` (vitest + `@testing-library/react`, mocked `/api/tweets` and `/api/candidates`, wrapping router + `FollowProvider`)
    - Cover: party defaults to "All parties" and has an accessible label; following toggle defaults off and has an accessible label; the three distinct empty states and the directory-link navigation; `<select>` lists "All parties" plus distinct parties; changing party or toggling following updates the feed in the same render while retaining selections
    - _Requirements: 1.1, 1.2, 1.7, 3.1, 3.2, 3.5, 3.6, 4.2, 4.3, 4.4, 4.5, 5.8, 6.1, 6.2, 6.3, 6.4_

- [ ] 6. Add toolbar/select/toggle styles
  - [ ] 6.1 Add CSS for the filter toolbar in `client/src/features/tweets/Tweets.module.css`
    - Add classes for the toolbar layout, the party `<select>`, and the following-only toggle, consistent with the existing voting toolbar/select styling
    - _Requirements: 1.1, 3.1_

- [ ] 7. Final checkpoint - full feature verified
  - Run `vitest --run` across the new and affected tests and the `tsc`/`vite build`. Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they are the property and example/interaction tests.
- The pure module (tasks 1–2) is completed and tested before the page wiring (tasks 4–5), so UI work builds on proven logic.
- Each task references the specific requirements and/or design properties it implements for traceability.
- Property tests run at least 100 iterations (`{ numRuns: 100 }` or higher, matching the existing tests' 200), one test per property, each carrying its feature/property comment tag.
- Checkpoints (tasks 3, 7) ensure incremental validation via the project's build and `vitest --run`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3", "1.5", "2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["5.1", "6.1"] },
    { "id": 7, "tasks": ["5.2"] },
    { "id": 8, "tasks": ["5.3"] }
  ]
}
```
