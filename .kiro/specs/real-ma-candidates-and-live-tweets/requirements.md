# Requirements Document

## Introduction

This feature replaces Easy Elect's illustrative, fictional demo content with real, sourced Massachusetts state election candidates and their actually-proposed policies, and adds live social posts (X/Twitter or an equivalent live source) fetched from real candidate accounts. Today all candidate and post data in `server/src/domain/` is explicitly fictional to avoid misattributing statements to real people. This feature is the replacement the README anticipates, so sourcing, attribution, accuracy, and legal/ToS compliance are first-class concerns.

The work has two tracks that share the existing architecture:

1. **Real candidate data** — a curated, human-verified dataset of real Massachusetts state election candidates, their offices/districts, and their actually-proposed stances on the existing issue set, each carrying a source URL for attribution, served through the existing read-only data API.
2. **Live social posts** — a server-side integration that fetches real posts from real candidate accounts via a live API, keeping credentials out of the browser, caching results to respect rate limits, and falling back to a last-known-good or curated dataset when live data is unavailable — mirroring the existing live-AI / scripted-fallback pattern.

Both tracks must keep the client and server domain type definitions in sync and preserve the Simple/Expert `Explain` dual-variant copy without distorting any candidate's real position.

## Glossary

- **EasyElect_System**: The overall Easy Elect application (client + server) serving the Massachusetts State Primary demo.
- **Data_API**: The read-only Express API under `/api` that serves curated domain data (candidates, issues, tweets, causes, connect, quiz).
- **Candidate_Dataset**: The curated collection of real Massachusetts state election candidate records sourced for this feature, replacing the fictional records in `server/src/domain/candidates.ts`.
- **Candidate_Record**: A single real candidate entry conforming to the `Candidate` type (id, name, party, office, district, tagline, bio, stances, website?, handle?).
- **Stance_Record**: A single `CandidateStance` (issueId, position, detail as `Explain`) attributed to a real candidate's actually-proposed policy.
- **Source_Attribution**: A verifiable source URL and human-readable publisher/date associated with a candidate record or stance, used to attribute content to its origin.
- **Explain_Copy**: The dual-variant `{ simple, expert }` explanatory text used throughout the domain data.
- **Issue_Set**: The fixed set of policy-area ids the app supports: `housing`, `education`, `guns`, `healthcare`, `climate`, `transit`.
- **Live_Posts_Provider**: The server-side module that fetches real social posts from a live external API using server-held credentials.
- **Live_Posts_Endpoint**: The Data_API endpoint (`GET /api/tweets`) that returns posts, whether sourced live, from cache, or from the fallback dataset.
- **Post_Cache**: A server-side store of recently fetched live posts, used to serve requests without re-calling the external API and to survive external outages.
- **Fallback_Posts_Dataset**: The curated, attributed set of real posts served when the Live_Posts_Provider is disabled or unavailable.
- **Post_Record**: A single post conforming to the `Tweet` type (id, candidateId, authorName, authorHandle, text, date, likes, reposts, tabs, context?, inReplyTo?, sourceUrl?).
- **Live_Credentials**: The external social-API key/token set, read from the server environment and never exposed to the browser.
- **Detail_Mode**: The user-selected `simple` or `expert` presentation mode that selects which variant of Explain_Copy to show.
- **Domain_Type_Definitions**: The shared TypeScript shapes in `server/src/domain/types.ts` and their mirror in `client/src/types/domain.ts`.

## Requirements

### Requirement 1: Real Massachusetts candidate dataset

**User Story:** As a Massachusetts voter using Easy Elect, I want to see real candidates running in the Massachusetts state election, so that I can learn about the people I can actually vote for.

#### Acceptance Criteria

1. THE Candidate_Dataset SHALL contain only Candidate_Records whose `name` matches a real, declared candidate for a Massachusetts state election office, whose `office` names a Massachusetts state election office, and whose `district` names the represented area.
2. THE Candidate_Dataset SHALL contain at least 2 Candidate_Records.
3. THE EasyElect_System SHALL represent each Candidate_Record using the existing `Candidate` type with no fields added, removed, or renamed and no field types changed.
4. WHERE a Candidate_Record specifies a party, THE EasyElect_System SHALL use a value from the existing `Party` set (`Democratic`, `Republican`, `Independent`, `Libertarian`, `Green-Rainbow`, `Nonpartisan`).
5. THE EasyElect_System SHALL assign each Candidate_Record a non-empty `id` that is unique across the Candidate_Dataset.
6. WHEN the Data_API receives `GET /api/candidates`, THE Data_API SHALL respond with HTTP 200 and the real Candidate_Dataset.
7. WHEN the Data_API receives `GET /api/candidates/:id` for an id present in the Candidate_Dataset, THE Data_API SHALL respond with HTTP 200 and the matching Candidate_Record.
8. IF the Data_API receives `GET /api/candidates/:id` for an id absent from the Candidate_Dataset, THEN THE Data_API SHALL respond with HTTP 404 and an error body.

### Requirement 2: Real, attributed candidate policy stances

**User Story:** As a beginner voter, I want each candidate's stances to reflect what they have actually proposed, so that I can trust the positions shown are accurate.

#### Acceptance Criteria

1. THE EasyElect_System SHALL base each Stance_Record on a position the attributed candidate has actually proposed or publicly stated, tied to a Source_Attribution.
2. THE EasyElect_System SHALL assign each Stance_Record an `issueId` that is one of `housing`, `education`, `guns`, `healthcare`, `climate`, or `transit`.
3. THE EasyElect_System SHALL include at most one Stance_Record per `issueId` for each Candidate_Record.
4. WHERE a Stance_Record includes Explain_Copy, THE EasyElect_System SHALL provide a non-empty `simple` variant and a non-empty `expert` variant that describe the same underlying position.
5. THE EasyElect_System SHALL write each Stance_Record's `simple` and `expert` variants so that both assert the same support-or-oppose direction and the same core proposal.
6. IF a candidate has no Source_Attribution for a position on an Issue_Set entry, THEN THE EasyElect_System SHALL omit a Stance_Record for that issue rather than infer one.

### Requirement 3: Source attribution for candidate content

**User Story:** As a reader, I want to see where each candidate's information comes from, so that I can verify the claims and trust the app is not inventing statements.

#### Acceptance Criteria

1. THE EasyElect_System SHALL associate each Candidate_Record with a Source_Attribution containing a non-empty source name and a resolvable source URL (HTTP or HTTPS scheme, 1 to 2048 characters) identifying where the record's information originated.
2. WHERE a Candidate_Record has an official campaign or government website, THE EasyElect_System SHALL populate the `website` field with that URL using an HTTP or HTTPS scheme and a length of 1 to 2048 characters.
3. WHEN the EasyElect_System presents a candidate's sourced content to a user, THE EasyElect_System SHALL display, within the candidate's presentation, a user-activatable link that navigates to the Source_Attribution URL.
4. IF a Source_Attribution URL for a presented candidate record is absent, malformed, or uses a scheme other than HTTP or HTTPS, THEN THE EasyElect_System SHALL display an indication that the source is unavailable in place of the source link while retaining the remaining candidate content.
5. IF a candidate position cannot be tied to a Source_Attribution that includes a non-empty source name and a resolvable HTTP or HTTPS source URL, THEN THE EasyElect_System SHALL exclude that position from the Candidate_Dataset.

### Requirement 4: Live social posts from real candidate accounts

**User Story:** As a voter following the race, I want to see candidates' real, recent social posts, so that I can follow what they are saying in their own words.

#### Acceptance Criteria

1. WHERE Live_Credentials are configured in the server environment, THE Live_Posts_Provider SHALL fetch, for each configured candidate account, up to the 50 most recent posts published within the last 30 days via the external social API.
2. THE Live_Posts_Provider SHALL map each fetched post into a Post_Record conforming to the existing `Tweet` type.
3. WHEN the Live_Posts_Provider maps a fetched post to a Post_Record, THE Live_Posts_Provider SHALL set the Post_Record's `candidateId` to the id of the Candidate_Record whose `handle`, compared case-insensitively after stripping a leading `@`, matches the post's author account.
4. WHEN the Live_Posts_Provider maps a fetched post to a Post_Record, THE Live_Posts_Provider SHALL set the Post_Record's `sourceUrl` to the original post's URL.
5. IF a fetched post's author account does not match any Candidate_Record `handle` under the normalization rule in criterion 3, THEN THE Live_Posts_Provider SHALL exclude that post from the returned results.
6. IF a live fetch does not complete within 10 seconds, THEN THE Live_Posts_Provider SHALL treat the fetch as failed and SHALL preserve the existing Post_Cache contents.
7. WHEN the Data_API receives `GET /api/tweets`, THE Data_API SHALL return Post_Records regardless of whether they originated from the live source, the Post_Cache, or the Fallback_Posts_Dataset.

### Requirement 5: Server-side credential handling

**User Story:** As the app operator, I want external social-API credentials handled only on the server, so that secrets are never exposed to users' browsers.

#### Acceptance Criteria

1. WHEN the Live_Posts_Provider initializes, THE Live_Posts_Provider SHALL read Live_Credentials exclusively from the server environment and SHALL NOT read them from any client-supplied input.
2. THE EasyElect_System SHALL exclude Live_Credentials values from every field of every response sent to the client, including response bodies, headers, and error messages.
3. IF a response payload would contain a Live_Credentials value, THEN THE EasyElect_System SHALL omit that value and SHALL continue serving the response without the credential.
4. WHERE one or more Live_Credentials are absent or empty in the server environment, THE Live_Posts_Provider SHALL report live posting status as disabled and SHALL serve fallback content instead of attempting a live request.
5. THE EasyElect_System SHALL document every Live_Credentials environment variable by name in `server/.env.example`, with each variable's value left as an empty or placeholder entry containing no real secret.

### Requirement 6: Caching and rate-limit handling for live posts

**User Story:** As the app operator, I want live post fetches cached and rate-limit-aware, so that the app stays responsive and does not exceed the external API's limits.

#### Acceptance Criteria

1. WHEN the Live_Posts_Provider successfully fetches posts, THE Live_Posts_Provider SHALL store the mapped Post_Records in the Post_Cache together with a retrieval timestamp recorded in UTC.
2. WHILE the age of the cached Post_Records (current time minus retrieval timestamp) is less than or equal to the configured cache lifetime, THE Live_Posts_Endpoint SHALL serve posts from the Post_Cache without calling the external API.
3. WHEN the age of the cached Post_Records exceeds the configured cache lifetime and the Post_Cache is non-empty, THE Live_Posts_Endpoint SHALL trigger the Live_Posts_Provider to fetch fresh posts from the external API.
4. IF the external social API returns a rate-limit response, THEN THE Live_Posts_Provider SHALL serve the most recent Post_Cache contents, return a success response, and include an indication that the data was served from cache due to rate limiting.
5. IF the external social API returns a rate-limit response AND the Post_Cache is empty, THEN THE Live_Posts_Provider SHALL return an error response indicating that live posts are temporarily unavailable, without retaining any partial Post_Records.
6. THE EasyElect_System SHALL provide a configurable cache lifetime value, expressed in seconds within the range 1 to 86400, through the server environment, with a documented default of 300 seconds applied when the value is unset or outside the valid range.

### Requirement 7: Graceful fallback when live posts are unavailable

**User Story:** As a user, I want the Tweets section to keep working even when the live feed is down, so that the app is always usable for demos and learning.

#### Acceptance Criteria

1. IF the Live_Posts_Provider is disabled because Live_Credentials are absent, THEN THE Live_Posts_Endpoint SHALL return the Fallback_Posts_Dataset within 2 seconds with a success response.
2. IF a live fetch fails for any reason (timeout exceeding the configured limit, network error, or non-success provider response) and the Post_Cache contains zero Post_Records, THEN THE Live_Posts_Endpoint SHALL return the Fallback_Posts_Dataset with a success response.
3. IF a live fetch fails for any reason and the Post_Cache contains one or more Post_Records, THEN THE Live_Posts_Endpoint SHALL return the cached Post_Records with a success response.
4. WHEN the Live_Posts_Endpoint returns posts, THE Live_Posts_Endpoint SHALL include a source indicator field whose value identifies the origin as exactly one of live, cache, or fallback.
5. THE Fallback_Posts_Dataset SHALL contain between 1 and 50 Post_Records, and every Post_Record SHALL include non-empty text and a non-empty Source_Attribution identifying its real author.
6. WHEN the Data_API returns a Post_Record, THE Data_API SHALL preserve the Post_Record's tab assignments for each of the Recent, Notable, Needs Context, and Interactions tabs so that a Post_Record assigned to a tab remains retrievable under that tab.

### Requirement 8: Detail-mode fidelity for real content

**User Story:** As a user switching between Simple and Expert modes, I want both versions to reflect the same real position, so that neither mode misrepresents a candidate.

#### Acceptance Criteria

1. WHEN a user selects a Detail_Mode, THE EasyElect_System SHALL present, within 1 second, the variant of Explain_Copy matching the selected Detail_Mode for every displayed Candidate_Record and Stance_Record.
2. IF the Explain_Copy variant matching the selected Detail_Mode is missing for a displayed record, THEN THE EasyElect_System SHALL display an indication that the detail is unavailable while preserving the rest of the record's presentation.
3. THE EasyElect_System SHALL ensure the `simple` and `expert` variants of any Explain_Copy assert the same position with non-contradictory sets of claims.
4. WHERE added context is attached to a Post_Record, THE EasyElect_System SHALL keep that context attributed to the underlying debate and SHALL exclude any statement that endorses, ranks, or recommends a position.

### Requirement 9: Client and server domain type consistency

**User Story:** As a developer maintaining Easy Elect, I want the client and server domain types to stay in sync, so that real data serialized by the server deserializes correctly in the client.

#### Acceptance Criteria

1. WHEN a shape in `server/src/domain/types.ts` is added, removed, or has any field added, removed, renamed, retyped, or changed between required and optional, THE EasyElect_System SHALL carry the identical change into the corresponding shape in `client/src/types/domain.ts` within the same change set.
2. THE EasyElect_System SHALL keep each shape served by the Data_API (including at minimum `Candidate`, `CandidateStance`, and `Tweet`) structurally equivalent between `server/src/domain/types.ts` and `client/src/types/domain.ts`, where structural equivalence means identical field names, identical TypeScript field types, and identical required-versus-optional status for every field.
3. WHEN the client receives a Data_API response for candidate or post data, THE client SHALL deserialize it into the client Domain_Type_Definitions and produce zero TypeScript type errors when the client project is type-checked.
4. IF a Data_API response contains a field whose name or type does not match the client Domain_Type_Definitions for the requested shape, THEN THE client SHALL surface an error indicating the type mismatch and SHALL NOT render the mismatched data as valid.

### Requirement 10: Data freshness and update strategy

**User Story:** As the app operator, I want a defined way to refresh real candidate and post data, so that the information stays current as the election progresses.

#### Acceptance Criteria

1. THE EasyElect_System SHALL store, for the Candidate_Dataset, a retrieval-or-last-reviewed date in ISO 8601 date format (YYYY-MM-DD).
2. WHEN a request reaches the Live_Posts_Endpoint and the elapsed time since the last successful live fetch is greater than or equal to the configured cache lifetime, THE Live_Posts_Provider SHALL perform a fresh fetch of posts before returning the response.
3. WHEN a request reaches the Live_Posts_Endpoint and the elapsed time since the last successful live fetch is less than the configured cache lifetime, THE Live_Posts_Provider SHALL return the cached posts without performing a fresh fetch.
4. IF a fresh fetch triggered by an elapsed cache lifetime fails, THEN THE Live_Posts_Provider SHALL serve the Fallback_Posts_Dataset, retain the previous last-successful-fetch timestamp unchanged, and include an indication in the response that the data is served from fallback.
5. THE EasyElect_System SHALL provide, in the repository, written documentation that describes the steps for updating the Candidate_Dataset and the Fallback_Posts_Dataset, including where each dataset is stored and how to record its retrieval-or-last-reviewed date.

### Requirement 11: Legal, Terms-of-Service, and PII compliance

**User Story:** As the app operator, I want the use of real people's public statements to comply with the external API's terms and privacy expectations, so that the app can display real content responsibly.

#### Acceptance Criteria

1. THE EasyElect_System SHALL display, from live posts, only content that the external social API marks as publicly published.
2. IF a fetched post's public-publication status cannot be confirmed, THEN THE EasyElect_System SHALL exclude that post and SHALL retain no personal data from it.
3. THE EasyElect_System SHALL attribute each displayed Post_Record to its author via a non-empty `authorName`, a non-empty `authorHandle`, and a Source_Attribution link that resolves to the original post.
4. IF a Post_Record is missing any required attribution field (`authorName`, `authorHandle`, or Source_Attribution link), THEN THE EasyElect_System SHALL exclude that Post_Record from display.
5. THE EasyElect_System SHALL limit stored personal data to the public author identity (`authorName`, `authorHandle`) and public post content required to render the Tweets section, and SHALL exclude any other personal data.
6. WHERE the external social API's terms require a usage disclosure or attribution notice, THE EasyElect_System SHALL present that notice within every view that renders live post content.
7. IF a displayed candidate requests removal of their content, THEN THE EasyElect_System SHALL remove that content from the Candidate_Dataset and Fallback_Posts_Dataset within 30 days of the request and SHALL record the removal in a documented removal log.
