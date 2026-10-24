# News Section Requirements Document

## Introduction

The "Tweets" section currently renders no content in any of its four tabs (Recent, Notable, Needs Context, Interactions). Every tab shows the "No posts in this tab yet." empty state, so the section appears broken to the user.

The underlying reason is that the section was designed around genuine, verified x.com (Twitter) posts served from a fallback dataset (`tweets` in `server/src/domain/tweets.ts`), and that dataset is empty. x.com gates post text, status IDs, and engagement counts behind authentication, so the real post data cannot be verified or sourced without a paid X API subscription. As a result the section cannot be populated under its current x.com-post design.

The chosen direction is to repurpose the section as a curated candidate News feed. Instead of x.com posts, the section serves a curated, static dataset of real, publicly published news items (articles from news outlets, .gov pages, and official campaign sites) tied to the candidates on the ballot. This reuses the same source-verification discipline already applied to candidate `stances` in `candidates.ts`: every item links to a resolvable HTTP/HTTPS source and is only included if it can be verified.

The change is deliberately minimal/surgical: it keeps the existing `/api/tweets` request/response envelope, the cache -> live -> fallback decision tree, the `source` origin indicator, and the party + "only candidates I follow" filters. What changes is the data model (a news item replaces an x.com post) and the data served on the fallback branch. The four tabs are retained with news-oriented meaning. Every non-Tweets section (candidates, issues, causes, connect, election, quiz) is unaffected.

## Definitions

- News_Item: A curated record describing a single, real, publicly published news article (or official-page item) relevant to one or more candidates. Replaces the `Tweet` shape for this section. It carries: `id`, `candidateIds` (one or more candidate ids), `title` (the article headline), `outlet` (the publisher/source name), `url` (resolvable HTTP/HTTPS link to the article), `date` (ISO 8601), `tabs` (one or more of the four tabs), and optional `context` (a neutral editorial `Explain` block for the Needs Context tab).
- News_Dataset: The curated static array served on the fallback branch of `resolveTweets()` -- the renamed/repurposed `tweets` export in `server/src/domain/tweets.ts`.
- Verified_Source: A source URL that resolves over HTTP/HTTPS to a real, publicly accessible article from a reputable outlet, .gov page, or official campaign site. Replaces the prior "sourceUrl host must be x.com" guarantee.
- Four tabs: Recent News, Notable News, Needs Context, Interactions.
- Interactions tab: Items that reference two or more candidates (`candidateIds.length >= 2`).
- Any-of matching: For the party filter, the following-only filter, and followed-first ordering, a News_Item matches/floats when ANY of its `candidateIds` satisfies the predicate.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Tweets section loads with live posting disabled (the default, no credentials) THEN the system serves an empty fallback dataset and every tab (Recent, Notable, Needs Context, Interactions) shows "No posts in this tab yet."

1.2 WHEN a live fetch fails or is rate-limited with an empty cache and the request resolves to fallback THEN the system serves zero posts, leaving all four tabs empty.

1.3 WHEN the section is designed around genuine, verified x.com posts THEN the dataset cannot be populated, because x.com gates post text, status IDs, and engagement counts behind authentication and a paid API -- so no verifiable records can be added and the section stays empty.

1.4 WHEN the feed renders THEN it is limited to an x.com-post shape (`authorHandle`, `likes`, `reposts`, a single `candidateId`) that cannot represent curated news tied to one or more candidates.

### Expected Behavior (Correct)

2.1 WHEN the News section loads with live posting disabled (the default, no credentials) THEN the system SHALL serve a non-empty News_Dataset of News_Item records on the fallback branch, and at least the Recent News tab SHALL display one or more items instead of the empty state.

2.2 WHEN a live fetch fails or is rate-limited with an empty cache and the request resolves to fallback THEN the system SHALL serve the curated News_Dataset so the section is populated rather than empty.

2.3 WHEN a News_Item is added to the dataset THEN the system SHALL require it to be a Verified_Source: its `url` SHALL be a resolvable HTTP/HTTPS link to a real, publicly accessible article, and its `title`, `outlet`, `url`, and `date` (valid ISO 8601) SHALL be non-empty -- never fabricated.

2.4 WHEN a News_Item is assigned candidates THEN each id in `candidateIds` (length >= 1, no duplicates) SHALL match a real candidate in `candidates.ts` (`candidatesById`), so items may be associated with any of the 26 candidates, not only Healey and Minogue.

2.5 WHEN a candidate has no verified news items THEN the system SHALL show nothing for that candidate (no placeholder, no fabricated item); an absent candidate simply contributes no items.

2.6 WHEN a tab is selected THEN the system SHALL show exactly the items whose `tabs` array contains that tab, where the four tabs are "Recent News", "Notable News", "Needs Context", and "Interactions"; the Interactions tab SHALL show items whose `candidateIds` length is >= 2, and the Needs Context tab SHALL render each item's neutral `context` clarification (which SHALL NOT endorse, rank, or recommend).

2.7 WHEN the party filter is set to a specific party THEN a News_Item SHALL match when ANY of its `candidateIds` resolves to that party (any-of matching); when "only candidates I follow" is on, a News_Item SHALL be kept when ANY of its `candidateIds` is followed (any-of matching); an empty followed set SHALL yield an empty feed, not an error.

2.8 WHEN the feed is ordered THEN items where ANY of `candidateIds` is followed SHALL be stably floated ahead of the rest (any-of matching), and items within the same group SHALL be ordered by `date` most-recent-first.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the `/api/tweets` endpoint is called THEN the system SHALL CONTINUE TO return the `{ posts, source }` envelope and SHALL CONTINUE TO resolve it via the cache -> live -> fallback decision tree in `resolveTweets()`.

3.2 WHEN the feed renders THEN the system SHALL CONTINUE TO show the origin indicator (Live / Cached / Fallback) for the served source and the usage/attribution notice.

3.3 WHEN the section renders THEN the system SHALL CONTINUE TO support the four tabs, tab-membership filtering via `filterByTab`, the party filter, and the "only candidates I follow" toggle.

3.4 WHEN the filters and ordering run THEN they SHALL CONTINUE TO be pure, React-free, and mutate none of their inputs, consistent with the existing `applyFeedFilters` / `orderByFollowed` contract (adapted to `candidateIds`).

3.5 WHEN the curated dataset is served THEN the system SHALL keep it within 0..100 records with every `url` resolvable over HTTP/HTTPS, and SHALL NOT fabricate article content, headlines, outlets, or dates.

3.6 WHEN any section other than News/Tweets is used (candidates, issues, causes, connect, election, quiz) THEN the system SHALL CONTINUE TO behave exactly as before.
