# Data Sources & Compliance

This document is the operator's guide for the real Massachusetts state-election
content served by Easy Elect. It covers where each dataset lives, how to record
when it was last reviewed, the usage/attribution notice that must appear wherever
live posts are shown, and the process for removing content on request.

It satisfies:

- **Requirement 10.5** — written documentation of where each dataset is stored and
  how to record its retrieval-or-last-reviewed date.
- **Requirement 11.6** — the external social API usage/attribution notice text.
- **Requirement 11.7** — the content-removal process and an append-only, dated
  removal log.

> All candidate records and fallback posts must be **real, human-verified, and
> sourced**. Never infer a stance, invent a quote, or attribute a statement that a
> candidate has not actually proposed or published. If a position cannot be tied to
> a resolvable source, omit it rather than guess.

---

## 1. Where the datasets live

| Dataset | File | Served by | Notes |
|---|---|---|---|
| **Candidate_Dataset** | [`server/src/domain/candidates.ts`](./candidates.ts) | `GET /api/candidates`, `GET /api/candidates/:id` | Real MA state-election candidates, their offices/districts, and their actually-proposed stances. Each record carries a `source: SourceAttribution`. |
| **Fallback_Posts_Dataset** | [`server/src/domain/tweets.ts`](./tweets.ts) | `GET /api/tweets` (when live posting is disabled or unavailable) | Curated, attributed real posts served as the graceful fallback. Each record has non-empty `text` and full attribution (`authorName`, `authorHandle`, `sourceUrl`). |

The shared record shapes (`Candidate`, `CandidateStance`, `Tweet`,
`SourceAttribution`) are defined in [`server/src/domain/types.ts`](./types.ts) and
mirrored in `client/src/types/domain.ts`. Any change to a shape in one file must be
carried into the other in the same change set (Requirement 9).

Live posts are fetched at runtime by `server/src/posts/provider.ts` using the
server-only credentials documented in [`server/.env.example`](../../.env.example);
the fallback dataset above is what the endpoint serves whenever the live source is
disabled, rate-limited, timed out, or otherwise unavailable.

---

## 2. Recording each dataset's `reviewedOn` date

Every `SourceAttribution` record carries a `reviewedOn` field — the
retrieval-or-last-reviewed date for that piece of sourced content (Requirement 10.1).

**Format:** ISO 8601 calendar date, `YYYY-MM-DD` (for example `2025-02-14`). It must
parse to a real calendar date. No time component, no timezone — a date only.

**Where it is recorded:** in the `reviewedOn` field of each `SourceAttribution`:

- On each candidate record: `candidate.source.reviewedOn`.
- On each stance that carries its own source: `stance.source.reviewedOn`.

```ts
// server/src/domain/candidates.ts
{
  // ...candidate fields...
  source: {
    name: "Example Publisher / Official Campaign Site",
    url: "https://example.org/the-source-page",
    reviewedOn: "2025-02-14", // ISO 8601 YYYY-MM-DD, the day you verified this record
  },
}
```

### How to update a dataset and its review date

1. Open the dataset file (`candidates.ts` or `tweets.ts`).
2. Verify each record against its cited `source.url`. Confirm the candidate is a real,
   declared MA state-election candidate and that each stance reflects a position they
   have actually proposed or publicly stated.
3. For any record you verified or changed, set that record's `source.reviewedOn`
   (and any affected stance's `source.reviewedOn`) to **today's date** in `YYYY-MM-DD`.
4. If a position can no longer be tied to a resolvable HTTP/HTTPS source, remove that
   stance rather than leaving it unsourced (Requirement 2.6 / 3.5).
5. Run the server test suite so the dataset-validity and ISO-date property tests
   confirm the data still conforms before committing.

For the fallback posts, the same discipline applies: keep `authorName`,
`authorHandle`, and `sourceUrl` present and accurate, and keep tab assignments
covering all four tabs (Recent, Notable, Needs Context, Interactions).

---

## 3. External API usage & attribution notice (Requirement 11.6)

Where the external social API's terms require a usage disclosure or attribution
notice, that notice must be presented **within every view that renders live post
content**. In this app it is rendered by the posts-status component
(`client/src/components/PostsStatus.tsx`) alongside the origin indicator
("Live" / "Cached" / "Fallback").

Use the following notice text (adapt the provider name to the concrete external
social API in use):

> **Posts are retrieved from the external social API and are shown with
> attribution to their original authors. Each post links back to the original
> source. Easy Elect displays only publicly published content and is not
> affiliated with or endorsed by the post authors or the social platform.**

Rules:

- The notice must appear in **every** view that renders live post content, not just
  one page.
- Attribution to the author (`authorName`, `authorHandle`) and a resolvable link back
  to the original post (`sourceUrl`) must accompany each displayed post
  (Requirements 11.3, 11.4). Posts missing any of those fields are excluded from
  display.
- Only publicly published content is shown (Requirement 11.1). Posts whose public
  status cannot be confirmed are excluded and no personal data is retained
  (Requirement 11.2).
- Only the public author identity (`authorName`, `authorHandle`) and public post
  content needed to render the Tweets section are stored (Requirement 11.5).

---

## 4. Content-removal process (Requirement 11.7)

If a displayed candidate requests removal of their content, remove that content from
the **Candidate_Dataset** (`candidates.ts`) and the **Fallback_Posts_Dataset**
(`tweets.ts`) **within 30 days** of the request, and record the removal in the log
below.

### Procedure

1. **Record the request.** On receipt, note the date, who requested it, and which
   content (candidate id, post id(s), or stance) is affected.
2. **Remove the content within 30 days.**
   - Candidate record or stance → delete it from `candidates.ts`.
   - Post → delete it from `tweets.ts`. Live posts for a removed candidate stop
     appearing automatically once the candidate's `handle` no longer matches (and the
     cache expires), but delete any fallback posts for that author explicitly.
   - Also remove any personal data retained from the content being removed.
3. **Add a log entry.** Append a dated entry to the **Removal Log** below. The log is
   **append-only**: never edit or delete existing entries; add a new entry to correct
   or supersede a prior one.
4. **Commit** the dataset change and the log entry together, referencing the request.

---

## 5. Removal Log (append-only)

Each entry records one completed removal. **Do not edit or delete existing entries.**
Add new entries at the bottom. Use `YYYY-MM-DD` dates.

Entry format:

```
### <removal date YYYY-MM-DD>
- Requested on: <YYYY-MM-DD>
- Requested by: <name / role / contact reference>
- Content removed: <candidate id / post id(s) / stance issueId>
- Dataset(s) affected: candidates.ts | tweets.ts
- Notes: <why / scope / any follow-up>
```

<!-- Append new removal entries below this line. Do not modify entries above it. -->

_No removals recorded yet._
