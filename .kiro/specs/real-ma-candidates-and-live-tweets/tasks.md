# Implementation Plan: Real MA Candidates and Live Tweets

## Overview

This plan replaces Easy Elect's fictional candidate and post data with real, sourced
Massachusetts state-election content and adds a server-side live-posts integration that
mirrors the existing AI provider / scripted-fallback pattern. Work is implemented in
TypeScript across the npm-workspace monorepo (`client/` React + Vite, `server/` Express +
ESM with `.js` import extensions). Tests use Vitest in both workspaces, Supertest for the
API, Testing Library for UI, and `fast-check` for property-based tests (minimum 100
iterations each).

The build order is deliberate and incremental: the shared type additions land first (so
every later module compiles against them), then the pure/unit-testable building blocks
(cache, handle normalization, URL guard), then the provider, then the route orchestration
that wires them together, then the real datasets, then the client mirror and consumers,
and finally the parity tests and documentation. No module is left orphaned — each task
either is consumed by a later task or wires an earlier one into the running app.

> **Intentional deviation flagged for the user (Req 1.3 vs Req 3.1).** Requirement 1.3
> says the `Candidate` type must have "no fields added," but Requirement 3.1 requires
> source attribution on every candidate record. Per the design decision, Requirement 3
> governs: a required `source: SourceAttribution` field is added to `Candidate` (and an
> optional `source?` to `CandidateStance`), and the change is mirrored into the client
> types in the same change set (Req 9.1). This is the one deliberate departure from
> 1.3's wording; confirm if a side-car `sources.ts` is preferred instead.

## Tasks

- [x] 1. Add shared domain type additions and mirror them to the client
  - [x] 1.1 Extend `server/src/domain/types.ts` with the new shapes
    - Add `SourceAttribution { name: string; url: string; reviewedOn: string }`
    - Add required `source: SourceAttribution` to `Candidate`
    - Add optional `source?: SourceAttribution` to `CandidateStance`
    - Add `PostsSource = "live" | "cache" | "fallback"` and `TweetsResponse { posts: Tweet[]; source: PostsSource }`
    - Leave `Tweet` structurally unchanged
    - _Requirements: 2.1, 3.1, 4.7, 7.4, 10.1_

  - [x] 1.2 Mirror the identical additions into `client/src/types/domain.ts`
    - Carry `SourceAttribution`, `source` on `Candidate`, optional `source?` on `CandidateStance`, `PostsSource`, and `TweetsResponse` with identical field names, types, and required/optional status
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 2. Implement the post cache module (`server/src/posts/cache.ts`)
  - [x] 2.1 Implement cache store, freshness, and lifetime config
    - Create `CacheEntry { posts: Tweet[]; fetchedAt: number }` (UTC epoch ms)
    - Implement `setCache(posts, now?)`, `getCache()`, `isCacheNonEmpty()`, `isFresh(lifetimeSeconds, now?)`
    - Implement `cacheLifetimeSeconds()` reading `EASYELECT_POSTS_CACHE_TTL_SECONDS`, clamped to `[1, 86400]`, defaulting to `300` when unset, non-numeric, or out of range
    - Use the optional `now?` parameter so freshness logic is deterministic/testable
    - _Requirements: 6.1, 6.2, 6.6, 10.3_

  - [x] 2.2 Write property test for cache round-trip with UTC timestamp
    - **Property 12: Cache store round-trips posts with a UTC timestamp**
    - **Validates: Requirements 6.1**

  - [x] 2.3 Write property test for cache freshness boundary
    - **Property 10: Fresh cache is served without an external call** (unit-level portion: `isFresh` true within lifetime)
    - Exercise offsets around the lifetime boundary with an explicit `now`
    - **Validates: Requirements 6.2, 10.3**

  - [x] 2.4 Write property test for cache lifetime clamping
    - **Property 15: Cache lifetime is always a valid clamped value**
    - Generate arbitrary environment strings; assert integer result in `[1, 86400]` or exactly `300`
    - **Validates: Requirements 6.6**

- [x] 3. Implement handle normalization and post mapping/filtering helpers
  - [x] 3.1 Implement `normalizeHandle` in `server/src/posts/provider.ts`
    - Lowercase and strip at most one leading `@`; idempotent
    - _Requirements: 4.3_

  - [x] 3.2 Write property test for handle normalization
    - **Property 1: Handle normalization is idempotent and case/@-insensitive**
    - **Validates: Requirements 4.3**

  - [x] 3.3 Implement the raw-post mapper/filter in `server/src/posts/provider.ts`
    - Map a raw external post to a `Tweet`: set `id`, non-empty `text`, ISO `date`, numeric `likes`/`reposts`, `tabs` array, `authorName`, `authorHandle`, and `sourceUrl` from the original post URL
    - Set `candidateId` to the candidate whose `handle` matches via `normalizeHandle` (Req 4.3)
    - Drop posts whose author matches no candidate handle (Req 4.5), whose public-publication status is unconfirmed (Req 11.2), or missing any required attribution field `authorName`/`authorHandle`/`sourceUrl` (Req 11.4)
    - Copy only `authorName`, `authorHandle`, and public post content into the `Tweet` — no other personal fields (Req 11.5)
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 3.4 Write property test for handle matching and exclusion
    - **Property 2: Posts from unmatched handles are excluded; matched posts get the correct candidateId**
    - **Validates: Requirements 4.3, 4.5**

  - [x] 3.5 Write property test for required-field mapping and source URL preservation
    - **Property 3: Post mapping populates required fields and preserves the source URL**
    - **Validates: Requirements 4.2, 4.4**

  - [x] 3.6 Write property test for public-only publication filtering
    - **Property 4: Only publicly published posts are returned**
    - **Validates: Requirements 11.1, 11.2**

  - [x] 3.7 Write property test for full attribution of served posts
    - **Property 5: Every served post is fully attributed**
    - **Validates: Requirements 11.3, 11.4**

  - [x] 3.8 Write property test for data minimization of mapped posts
    - **Property 6: Mapped posts carry no personal data beyond the allowed set** (mapped `Tweet` key set is a subset of the declared `Tweet` fields)
    - **Validates: Requirements 11.5**

- [x] 4. Implement the live fetch path of the provider (`server/src/posts/provider.ts`)
  - [x] 4.1 Implement `isLivePostsEnabled` and `fetchLivePosts`
    - `isLivePostsEnabled()` = truthy `LIVE_POSTS_BEARER_TOKEN` (and any other required var), reading credentials only from `process.env` (Req 5.1)
    - `fetchLivePosts(candidates)` requests up to the 50 most recent posts within the last 30 days per configured account (Req 4.1), maps/filters via Task 3, and returns `FetchOutcome` = `{ kind: "ok"; posts }` | `{ kind: "rateLimited" }` | `{ kind: "failed" }`
    - Wrap the fetch in a 10s `AbortController` timeout → `{ kind: "failed" }` (Req 4.6)
    - HTTP 429 / documented rate-limit signal → `{ kind: "rateLimited" }`; non-success / network error → `{ kind: "failed" }`; never throw
    - Log fall-through with `console.warn` carrying no credential values
    - _Requirements: 4.1, 4.6, 5.1, 6.4, 7.2, 7.3_

  - [x] 4.2 Write unit test for the 10s timeout treated as failed
    - Use a controllable fake timer/fetch so a slow fetch yields `{ kind: "failed" }`
    - _Requirements: 4.6_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Build the real candidate dataset (`server/src/domain/candidates.ts`)
  - [x] 6.1 Replace the fictional array with the real, sourced MA candidate dataset
    - At least 2 records; each `id` non-empty and unique; `party` from the `Party` union; `office`/`district` naming real MA state-election roles/areas
    - Each record carries `source: SourceAttribution` with non-empty `name`, HTTP/HTTPS `url` (1–2048 chars), and ISO `reviewedOn` (YYYY-MM-DD)
    - Optional `website` (HTTP/HTTPS, 1–2048) and optional `handle`
    - Non-empty `bio.simple`/`bio.expert`
    - Stances: `issueId` ∈ {housing, education, guns, healthcare, climate, transit}; ≤ 1 stance per issue; non-empty `detail.simple`/`detail.expert` asserting the same direction/proposal; each present stance carries a `source`; omit any stance lacking a valid source rather than inferring one
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.5, 10.1_

  - [x] 6.2 Write property test for candidate dataset validity
    - **Property 17: Candidate dataset validity**
    - **Validates: Requirements 1.4, 1.5, 3.1, 3.2**

  - [x] 6.3 Write property test for stance dataset validity
    - **Property 18: Stance dataset validity**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.6, 3.5**

  - [x] 6.4 Write property test for source-attribution dates
    - **Property 19: Source attribution dates are valid ISO calendar dates**
    - **Validates: Requirements 10.1**

  - [x] 6.5 Write unit test for dataset size and uniqueness floor
    - Assert at least 2 records and all ids unique
    - _Requirements: 1.2, 1.5_

- [x] 7. Build the real fallback posts dataset (`server/src/domain/tweets.ts`)
  - [x] 7.1 Replace the fictional array with the real `Fallback_Posts_Dataset`
    - 1–50 `Tweet` records; every record has non-empty `text` and full attribution (`authorName`, `authorHandle`, `sourceUrl`)
    - `candidateId` matches a real candidate via normalized handle
    - Tab assignments cover all four tabs (recent, notable, needsContext, interactions) so each tab is populated
    - At least one record carries `context` (preserves the Needs Context expectation)
    - _Requirements: 7.5, 7.6, 11.3, 11.4_

  - [x] 7.2 Write property test for fallback dataset validity
    - **Property 20: Fallback dataset validity**
    - **Validates: Requirements 7.5**

- [x] 8. Wire the tweets orchestration into the data route (`server/src/routes/data.ts`)
  - [x] 8.1 Replace `GET /tweets` with the cache → live → fallback envelope orchestration
    - Return `TweetsResponse { posts, source }`
    - Disabled (no credentials) → serve fallback, `source: "fallback"`, no network call (Req 5.4, 7.1)
    - Non-empty fresh cache → serve cache, `source: "cache"`, no external call (Req 6.2, 10.3)
    - Stale/empty cache while enabled → attempt live fetch (Req 6.3, 10.2): success maps/filters + stores in cache with UTC timestamp, `source: "live"`
    - Rate-limited with non-empty cache → serve cache as success, `source: "cache"`; rate-limited with empty cache → error "temporarily unavailable", retain no partial records (Req 6.4, 6.5)
    - Timeout/network/non-success with non-empty cache → serve cache (`source: "cache"`), else fallback (`source: "fallback"`); leave last-successful timestamp unchanged (Req 7.2, 7.3, 10.4)
    - _Requirements: 4.7, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 10.2, 10.3, 10.4_

  - [x] 8.2 Add `GET /tweets/status` mirroring `GET /ai/status`
    - Respond `{ livePostsEnabled: isLivePostsEnabled() }`; never include the credential
    - _Requirements: 4.7, 5.4_

  - [x] 8.3 Write property test for the source discriminator
    - **Property 7: The source indicator is always exactly one of live, cache, or fallback** across enabled/disabled × cache empty/fresh/stale × outcome success/rate-limited/failed
    - **Validates: Requirements 4.7, 7.4**

  - [x] 8.4 Write property test for disabled-mode fallback with no network call
    - **Property 8: Disabled live posting serves fallback and makes no network call**
    - **Validates: Requirements 5.4, 7.1**

  - [x] 8.5 Write property test for fresh-cache serving without external call
    - **Property 10: Fresh cache is served without an external call** (endpoint-level: `source: "cache"`, zero fetch calls)
    - **Validates: Requirements 6.2, 10.3**

  - [x] 8.6 Write property test for stale-cache fetch trigger
    - **Property 11: Stale cache triggers a fresh fetch**
    - **Validates: Requirements 6.3, 10.2**

  - [x] 8.7 Write property test for failed/rate-limited fetch serving cache intact
    - **Property 13: A failed or rate-limited fetch serves cache when present and never loses or corrupts cache**
    - **Validates: Requirements 6.4, 7.3, 10.4**

  - [x] 8.8 Write property test for failed fetch with empty cache serving fallback
    - **Property 14: A failed fetch with an empty cache serves the fallback dataset**
    - **Validates: Requirements 7.2**

  - [x] 8.9 Write property test for credential non-serialization
    - **Property 9: Credentials never appear in any serialized response**
    - Set a sentinel `LIVE_POSTS_BEARER_TOKEN` value; assert it appears in neither response body nor any header on success and error responses
    - **Validates: Requirements 5.2, 5.3**

  - [x] 8.10 Write unit test for rate-limit-with-empty-cache error branch
    - Assert an error response "temporarily unavailable" and no partial records retained
    - _Requirements: 6.5_

- [x] 9. Migrate the existing API test to the envelope shape (`server/src/routes/data.test.ts`)
  - [x] 9.1 Update the `GET /api/tweets` assertions
    - Iterate `res.body.posts` instead of `res.body`
    - Assert `res.body.source` ∈ {`live`, `cache`, `fallback`}
    - Preserve existing candidate/context assertions against `res.body.posts`
    - _Requirements: 4.7, 7.4, 7.6_

- [x] 10. Checkpoint - Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement client source-URL guard and candidate source link
  - [x] 11.1 Add `isDisplayableSourceUrl` guard (client lib)
    - Return true exactly when the string is an HTTP/HTTPS URL of length 1–2048
    - _Requirements: 3.4_

  - [x] 11.2 Render the source link in `CandidateDetail.tsx`
    - Render a user-activatable link to `candidate.source.url` when the guard is true
    - Render a "source unavailable" indication (keeping the rest of the record) when the URL is absent, malformed, or non-HTTP(S)
    - _Requirements: 3.3, 3.4_

  - [x] 11.3 Write property test for the source-URL display guard
    - **Property 22: Source-URL display guard is correct**
    - **Validates: Requirements 3.3, 3.4**

- [x] 12. Implement client detail-mode variant selection
  - [x] 12.1 Add/confirm the Explain variant selector with "detail unavailable" handling
    - Return the exact non-empty variant for the selected mode when present; report "detail unavailable" (keeping the rest of the record) when the variant is missing
    - _Requirements: 8.1, 8.2_

  - [x] 12.2 Write property test for detail-mode variant selection
    - **Property 21: Detail-mode variant selection**
    - **Validates: Requirements 8.1, 8.2**

- [x] 13. Implement the client shape validator for Data_API payloads
  - [x] 13.1 Add a runtime shape validator and surface type-mismatch errors
    - Validate candidate/post payloads against the client domain shapes; on a missing/renamed/wrong-typed field, surface a type-mismatch error and do not render the payload as valid
    - _Requirements: 9.4_

  - [x] 13.2 Write property test for client rejection of shape-mismatched payloads
    - **Property 23: Client rejects shape-mismatched payloads**
    - **Validates: Requirements 9.4**

- [x] 14. Update the Tweets client consumer and add the posts-status component
  - [x] 14.1 Migrate `TweetsPage.tsx` to the envelope response
    - Change `useApiData<Tweet[]>` to `useApiData<TweetsResponse>`; read `data.posts` for the feed and `data.source` for the indicator
    - Preserve tab filtering (`tabs.includes(tab)`) and the followed-candidate float
    - _Requirements: 4.7, 7.4, 7.6_

  - [x] 14.2 Add `PostsStatus.tsx` following the `AiStatus.tsx` convention
    - Read `GET /api/tweets/status` and/or the `source` field; render the origin ("Live"/"Cached"/"Fallback") plus the required ToS attribution/usage notice so the notice appears in every view rendering live posts
    - _Requirements: 4.7, 7.4, 11.6_

  - [x] 14.3 Write property test for tab-membership preservation
    - **Property 16: Tab membership is preserved under filtering**
    - **Validates: Requirements 7.6**

  - [x] 14.4 Write unit test for the ToS notice rendering in the Tweets view
    - Assert the usage/attribution notice renders wherever live post content is shown
    - _Requirements: 11.6_

- [x] 15. Add the client/server shape-parity test
  - [x] 15.1 Write property/structural test for domain shape equivalence
    - **Property 24: Client and server domain shapes are structurally equivalent** — compare field descriptors (name, type, optionality) for `Candidate`, `CandidateStance`, `Tweet`, `SourceAttribution`, `TweetsResponse` across the two type files
    - **Validates: Requirements 9.1, 9.2**

  - [x] 15.2 Add a client type-check gate
    - Ensure `tsc --noEmit` passes for the client against the mirrored types
    - _Requirements: 9.3_

- [x] 16. Document environment variables and data-sources/compliance
  - [x] 16.1 Document the Live_Credentials and cache env vars in `server/.env.example`
    - Add `LIVE_POSTS_BEARER_TOKEN` (empty) and `EASYELECT_POSTS_CACHE_TTL_SECONDS` (default `300`), with no real secret values
    - _Requirements: 5.5, 6.6_

  - [x] 16.2 Write unit test asserting `.env.example` documents the credential vars with empty values
    - _Requirements: 5.5_

  - [x] 16.3 Create the data-sources & compliance doc (`server/src/domain/DATA_SOURCES.md`)
    - Describe where the candidate dataset and fallback posts live, how to record each dataset's `reviewedOn` date, the external API usage/attribution notice text, and the content-removal process with an append-only, dated removal log
    - _Requirements: 10.5, 11.6, 11.7_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (unit, property, and integration tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirement sub-clauses for traceability, and every property-based test task names the exact design property it implements.
- Property tests use `fast-check` with a minimum of 100 generated cases; time and network are made deterministic via an explicit `now`, injected fetch outcomes, and a `fetch` spy / fake timer.
- The 24 design properties are each implemented by a single property-based test, placed close to the code they validate so regressions surface early.
- Checkpoints ensure incremental validation; the shared type additions (Task 1) land first so all later modules compile against them.
- Non-computable criteria (real-world accuracy of names/offices/districts/stances — 1.1, 2.1, 2.5, 8.3, 8.4; server-only credential data flow — 5.1; removal process/log — 11.7) are enforced by curation review and by the dataset/doc tasks rather than by generated properties.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "16.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "16.2", "16.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "6.1", "7.1", "11.1", "12.1", "13.1"] },
    { "id": 3, "tasks": ["3.4", "3.5", "3.6", "3.7", "3.8", "4.1", "6.2", "6.3", "6.4", "6.5", "7.2", "11.2", "11.3", "12.2", "13.2", "15.1", "15.2"] },
    { "id": 4, "tasks": ["4.2", "8.1", "8.2", "14.2"] },
    { "id": 5, "tasks": ["8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "9.1", "14.1"] },
    { "id": 6, "tasks": ["14.3", "14.4"] }
  ]
}
```
