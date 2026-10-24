# Requirements Document

## Introduction

This feature adds filtering controls to the Tweets section so a voter can narrow the feed to posts from a chosen party and/or to posts from only the candidates they follow. Today the Tweets page offers four tabs (Recent, Notable, Needs Context, Interactions) and already floats followed candidates to the top of the feed, but it offers no way to restrict which posts appear by party affiliation or to see "my candidates only." A post does not carry a party directly; party lives on the Candidate record and must be resolved by joining the post's `candidateId` to candidate data. This feature introduces a party filter and a following-only filter that compose with the existing tab filter, keeps the core selection logic in a pure, testable module alongside the existing `tweetFilter.ts`, and defines the empty-state and no-follows behavior for every combination.

## Glossary

- **Tweets_Feed**: The React view at `client/src/pages/TweetsPage.tsx` that renders the list of served posts.
- **Post**: A `Tweet` record (`client/src/types/domain.ts`) with fields including `id`, `candidateId`, `tabs`, and others. A Post does not carry a party; party is resolved through its `candidateId`.
- **Candidate**: A `Candidate` record with an `id` and a `party` field.
- **Party**: One of the fixed values `Democratic`, `Republican`, `Independent`, `Libertarian`, `Green-Rainbow`, `Nonpartisan`.
- **Party_Filter**: The user-facing control that selects either a single Party or the sentinel "All parties".
- **Following_Filter**: The user-facing toggle that, when enabled, restricts the feed to Posts whose `candidateId` is in the user's followed set.
- **Followed_Set**: The set of `candidateId` values the user follows, read from `FollowContext` (`client/src/context/FollowContext.tsx`), persisted in localStorage.
- **Tab_Filter**: The existing tab-membership filter (`filterByTab` in `client/src/lib/tweetFilter.ts`) that selects Posts by `TweetTab`.
- **Party_Index**: A mapping from `candidateId` to Party, built from the Candidate records, used to resolve a Post's Party.
- **Feed_Filter_Module**: The pure filtering module that computes which Posts to display given the Posts, selected Tab, selected Party, following-only flag, Followed_Set, and Party_Index.
- **Unresolved_Post**: A Post whose `candidateId` has no matching entry in the Party_Index (no known Party).

## Requirements

### Requirement 1: Party filter control

**User Story:** As a voter browsing the Tweets section, I want to filter posts by a political party, so that I can focus on what candidates of that party are saying.

#### Acceptance Criteria

1. THE Tweets_Feed SHALL display a Party_Filter control offering the sentinel option "All parties" followed by one option for each distinct Party present among the loaded Candidate records, with Party options ordered alphabetically and each distinct Party appearing exactly once.
2. WHEN the Tweets_Feed first loads, THE Party_Filter SHALL default to the "All parties" option as the selected value.
3. WHILE the Party_Filter is set to "All parties", THE Feed_Filter_Module SHALL apply no party-based restriction to the Posts, retaining every Post that satisfies all other active filters.
4. WHEN the user selects a specific Party in the Party_Filter, THE Feed_Filter_Module SHALL include only Posts whose resolved Party equals the selected Party.
5. IF a Post is an Unresolved_Post with no resolved Party, THEN THE Feed_Filter_Module SHALL exclude that Post from the result WHILE the Party_Filter is set to a specific Party.
6. WHEN the loaded Candidate records contain zero Party values, THE Tweets_Feed SHALL display the Party_Filter control offering only the "All parties" option.
7. THE Party_Filter control SHALL expose an accessible label identifying the control as a party filter.

### Requirement 2: Resolving a post's party

**User Story:** As a voter, I want party filtering to reflect each post's actual candidate, so that the results are accurate even though posts do not store a party.

#### Acceptance Criteria

1. WHEN the Feed_Filter_Module processes a Post whose `candidateId` matches an entry in the Party_Index, THE Feed_Filter_Module SHALL resolve that Post's Party to the Party recorded for the matching entry.
2. IF the Feed_Filter_Module processes a Post whose `candidateId` is absent, null, or not found in the Party_Index, THEN THE Feed_Filter_Module SHALL classify that Post as an Unresolved_Post.
3. IF a Post is an Unresolved_Post AND the Party_Filter is set to a specific Party, THEN THE Feed_Filter_Module SHALL exclude that Post from the results.
4. WHILE the Party_Filter is set to "All parties", THE Feed_Filter_Module SHALL include each Unresolved_Post in the results, subject to the other active filters.

### Requirement 3: Following-only filter control

**User Story:** As a voter who follows specific candidates, I want to see posts only from the candidates I follow, so that I can read my chosen candidates without noise.

#### Acceptance Criteria

1. THE Tweets_Feed SHALL display a Following_Filter toggle control with an accessible label identifying it as a filter for followed candidates.
2. WHEN the Tweets_Feed first loads, THE Following_Filter SHALL default to disabled.
3. WHILE the Following_Filter is disabled, THE Feed_Filter_Module SHALL apply no following-based restriction to the Posts.
4. WHILE the Following_Filter is enabled, THE Feed_Filter_Module SHALL include only Posts whose `candidateId` is a member of the Followed_Set.
5. WHEN the user toggles the Following_Filter, THE Feed_Filter_Module SHALL re-apply the filter and update the displayed Posts within 500 milliseconds.
6. IF the Following_Filter is enabled AND the Followed_Set contains zero members, THEN THE Tweets_Feed SHALL display an empty-state message indicating that no followed candidates have posts to show, while retaining the Following_Filter toggle in its enabled state.
7. IF a Post has a `candidateId` that is not a member of any Candidate record when the Following_Filter is enabled, THEN THE Feed_Filter_Module SHALL exclude that Post from the displayed Posts.

### Requirement 4: Following-only when the user follows no one

**User Story:** As a voter who has not followed anyone, I want clear feedback when I turn on the following-only filter, so that I understand why the feed is empty and how to fix it.

#### Acceptance Criteria

1. WHILE the Following_Filter is enabled AND the Followed_Set is empty, THE Feed_Filter_Module SHALL produce zero Posts.
2. WHILE the Following_Filter is enabled AND the Followed_Set is empty, THE Tweets_Feed SHALL display a message stating that no candidates are followed and provide a navigable link to the candidate directory.
3. WHEN the user activates the link provided in the empty-following message, THE Tweets_Feed SHALL navigate to the candidate directory.
4. WHEN the Followed_Set transitions from empty to containing at least one Candidate WHILE the Following_Filter is enabled, THE Tweets_Feed SHALL replace the empty-following message with the Posts belonging to the followed Candidates.
5. IF the Following_Filter is enabled AND the Followed_Set is non-empty AND no Post exists for any followed Candidate, THEN THE Tweets_Feed SHALL display a message stating that followed candidates have no posts, distinct from the empty-following message.

### Requirement 5: Combining party, following, and tab filters

**User Story:** As a voter, I want the party filter, the following-only filter, and the tab selection to work together, so that I can narrow the feed along multiple dimensions at once.

#### Acceptance Criteria

1. THE Feed_Filter_Module SHALL include a Post in the results only WHERE the Post satisfies the active Tab_Filter AND the active Party_Filter AND the active Following_Filter.
2. WHERE no active Party_Filter is selected, THE Feed_Filter_Module SHALL treat the Party_Filter as satisfied by every Post.
3. WHILE the Following_Filter is disabled, THE Feed_Filter_Module SHALL treat the Following_Filter as satisfied by every Post.
4. THE Feed_Filter_Module SHALL preserve the relative input order of the Posts it includes, such that for any two included Posts their output positions follow the same ordering as their input positions.
5. IF a Post is an Unresolved_Post whose Candidate or Party cannot be determined from the Party_Index, THEN THE Feed_Filter_Module SHALL exclude that Post from the results whenever an active Party_Filter or an enabled Following_Filter is applied.
6. THE Feed_Filter_Module SHALL return a new array and SHALL NOT mutate the input Posts, the Followed_Set, or the Party_Index.
7. WHILE the Following_Filter is disabled, THE Tweets_Feed SHALL order included Posts so that every Post authored by a candidate in the Followed_Set appears ahead of every included Post not authored by a Followed_Set candidate, preserving relative input order within each of those two groups.
8. WHEN the active Tab_Filter, Party_Filter, or Following_Filter changes, THE Feed_Filter_Module SHALL recompute the results so they reflect the current value of all three filters.

### Requirement 6: Empty results after filtering

**User Story:** As a voter, I want a clear message when my filter combination matches no posts, so that I know the feed is working and I can adjust my filters.

#### Acceptance Criteria

1. IF the active combination of Tab_Filter, Party_Filter, and Following_Filter yields zero Posts AND the Followed_Set is non-empty or the Following_Filter is disabled, THEN THE Tweets_Feed SHALL display an empty-state message indicating that no posts match the current filters and SHALL display at least one actionable hint prompting the user to change or clear a filter.
2. WHEN the user changes the Party_Filter or toggles the Following_Filter to a combination that yields one or more Posts, THE Tweets_Feed SHALL replace the empty-state message with the matching Posts within 500 milliseconds and SHALL remove the empty-state message so it is not displayed concurrently with any Post.
3. IF the Following_Filter is enabled AND the Followed_Set is empty, THEN THE Tweets_Feed SHALL display an empty-state message indicating that the user is not following any Candidate, distinct from the no-matching-posts message.
4. WHILE the empty-state message is displayed, THE Tweets_Feed SHALL retain the current Tab_Filter, Party_Filter, and Following_Filter selections without resetting any filter to its default value.

### Requirement 7: Testable pure filtering logic

**User Story:** As a developer maintaining the Tweets section, I want the combined filtering logic isolated as pure functions, so that I can unit- and property-test it the way `filterByTab` is tested.

#### Acceptance Criteria

1. THE Feed_Filter_Module SHALL expose the combined filtering as a pure function that depends only on its explicit input parameters, performs no mutation of the input Posts, Followed_Set, or Party_Index or their elements, and returns the same output for the same inputs on every invocation.
2. THE Feed_Filter_Module SHALL accept, as explicit parameters, the Posts, the selected Tab, the selected Party or the "All parties" sentinel, the following-only flag, the Followed_Set, and the Party_Index.
3. THE Feed_Filter_Module SHALL reside in the client library directory alongside `tweetFilter.ts` and SHALL be importable without importing any React component.
4. WHEN the combined filter is applied, THE Feed_Filter_Module SHALL return the subset of input Posts that satisfy all enabled filters (Tab_Filter, and Party_Filter unless "All parties" is selected, and Following_Filter unless the following-only flag is disabled) in the same relative order as in the input Posts, including each qualifying Post exactly once and never a Post absent from the input.
5. WHEN the combined filter is applied with the "All parties" sentinel selected and the following-only flag disabled for a given Tab, THE Feed_Filter_Module SHALL return a result identical in membership and order to applying the existing Tab_Filter alone for that Tab.
6. IF the following-only flag is enabled, THEN THE Feed_Filter_Module SHALL include only those otherwise-qualifying Posts whose Candidate is contained in the Followed_Set, and SHALL return an empty result (not an error) when no qualifying Post's Candidate is in the Followed_Set.
7. IF a Party is selected (not the "All parties" sentinel) and a Post's Party cannot be resolved against the Party_Index, THEN THE Feed_Filter_Module SHALL treat that Post as an Unresolved_Post and SHALL exclude it from the result.
