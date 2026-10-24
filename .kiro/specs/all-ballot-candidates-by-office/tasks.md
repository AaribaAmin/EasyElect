# Implementation Plan: All Ballot Candidates By Office

## Overview

This plan expands Easy Elect's curated candidate dataset to the full Massachusetts
state-election sample ballot, groups candidates by race in the Voting UI, and keeps
the server/client domain types and runtime validator in sync.

The work is ordered so the shared contract comes first (the `Party` union and its
runtime validator), which unblocks every client-side change. Then the dataset and its
completeness/validity checks, then the pure grouping helper and its property tests,
then the UI changes and their component tests, then cross-cutting parity/regression
tests, and finally a full build/test verification.

Each task builds on the previous ones and ends with its work wired into the running
app and covered by tests. Tasks marked with `*` are optional test sub-tasks.

## Tasks

- [ ] 1. Extend the Party union and runtime validator (shared contract)
  - [ ] 1.1 Add the two new party members to both domain type files
    - Add `"Socialism and Liberation"` and `"Unenrolled"` to the `Party` union in `server/src/domain/types.ts`
    - Add the identical two members, in the same order, to the `Party` union in `client/src/types/domain.ts`
    - Keep both unions byte-for-byte identical in member set and ordering
    - _Requirements: 6.1, 6.2, 7.1, 7.2_
  - [ ] 1.2 Add the two new party members to the client runtime validator
    - Add `"Socialism and Liberation"` and `"Unenrolled"` to the `PARTIES` array in `client/src/lib/shape.ts` so `validateCandidate`/`validateCandidateList` accept them
    - _Requirements: 7.4_

- [ ] 2. Expand the candidate dataset to the full ballot
  - [ ] 2.1 Add Minimum_Viable_Records for every remaining ballot candidate
    - In `server/src/domain/candidates.ts`, leave the existing `maura-healey` and `mike-minogue` records unchanged (same ids, same researched content) — Governor race (Req 1.2)
    - Add one `Candidate` record per remaining ballot candidate across all 14 races in the design roster table (Senator in Congress, Governor Independent ticket, Attorney General, Secretary of State, Treasurer, Auditor, Representative in Congress, Councillor, Senator in General Court, Representative in General Court, District Attorney, Register of Probate, Sheriff (Vacancy), Council of Governments Executive Committee)
    - Each new record is a Minimum_Viable_Record: URL-safe kebab-case `id` (unique within the dataset), verbatim ballot `name`, correct `party`/`office`/`district`, `tagline: ""`, `bio: { simple: "", expert: "" }`, `stances: []`, and `source` = the Official_Ballot_Source `{ name, url, reviewedOn: "2026-10-24" }`
    - Omit `website` and `handle` on every new record
    - Statewide races use `district: "Massachusetts"`; district races use the exact qualifier from the ballot
    - For the Independent Governor ticket, confirm and use the candidate name EXACTLY as printed on the Official_Ballot_Source (the JAMES / KITTREDGE ticket). The design's placeholder "Donnelly James" MUST be verified and corrected against the official ballot — do not invent a name
    - Keep `candidatesById` derived exactly as `new Map(candidates.map((c) => [c.id, c]))`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.3_

- [ ] 3. Add the dataset completeness/validity helper
  - [ ] 3.1 Implement OFFICIAL_BALLOT_ROSTER and checkDatasetCompleteness
    - Add `BallotEntry` (`name`, `office`, `district`, `party`), `OFFICIAL_BALLOT_ROSTER: readonly BallotEntry[]`, `DatasetCompleteness` (`complete`, `missing`, `extra`), and `checkDatasetCompleteness(dataset, roster?)` co-located with the dataset (or in `server/src/domain/candidates.validation.ts`)
    - Match records to roster entries by `name`; report `missing` (ballot names with no record, Req 1.6) and `extra` (record names not on the ballot, Req 1.1); set `complete` true only when both are empty
    - _Requirements: 1.1, 1.6_
  - [ ]* 3.2 Write property test for dataset completeness (Property 6)
    - **Property 6: Every ballot candidate is present in the dataset**
    - **Validates: Requirements 1.1, 1.6**
    - Extend `server/src/domain/candidates.test.ts`: assert `checkDatasetCompleteness(candidates).complete` is true with empty `missing`/`extra`, iterating each `OFFICIAL_BALLOT_ROSTER` entry
    - Tag `Feature: all-ballot-candidates-by-office, Property 6`
  - [ ]* 3.3 Write property test for record structural validity (Property 7)
    - **Property 7: Every candidate record is structurally valid**
    - **Validates: Requirements 1.4, 2.1, 2.2, 5.3**
    - Extend `server/src/domain/candidates.validity.property.test.ts` over `fc.constantFrom(...candidates)`: non-empty unique `id`, `party` in union, non-empty `office`/`district` within 1–120 chars, source url rule, `reviewedOn === "2026-10-24"`; `numRuns: 100`
    - Tag `Feature: all-ballot-candidates-by-office, Property 7`
  - [ ]* 3.4 Write property test for Minimum_Viable_Record emptiness (Property 8)
    - **Property 8: Minimum_Viable_Records carry no fabricated content**
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**
    - For records whose `source.url` equals the Official_Ballot_Source: empty `stances`, empty `bio.simple`/`bio.expert`, absent `website`/`handle`; `numRuns: 100`
    - Tag `Feature: all-ballot-candidates-by-office, Property 8`
  - [ ]* 3.5 Write property test for party membership (Property 10, server side)
    - **Property 10: Party values are all in the union and client-accepted**
    - **Validates: Requirements 6.3, 7.1, 7.4**
    - Extend the validity test's `PARTY_SET` with the two new members and assert every candidate's `party` is in the union; `numRuns: 100`
    - Tag `Feature: all-ballot-candidates-by-office, Property 10`

- [ ] 4. Checkpoint - Ensure dataset and type tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement the pure race-grouping helper
  - [ ] 5.1 Create groupCandidatesByRace in client/src/lib/raceGroups.ts
    - Add `RaceGroup` (`office`, `district`, `candidates`), `RaceFilters` (`query`, `party`), and `groupCandidatesByRace(candidates, filters): RaceGroup[]`
    - Filter each candidate by both the party filter (`party === "all" || c.party === party`) and the query (case-insensitive `includes` over name/office/party/district); a candidate must pass both
    - Key by `normalize(office) + "\u0000" + normalize(district)` where `normalize(s) = s.trim().toLowerCase()`
    - Sort candidates within a group case-insensitively ascending by `name`; sort groups by normalized office then normalized district ascending
    - Carry verbatim (un-normalized) `office`/`district` from the first post-sort member for the heading; return `[]` when nothing survives
    - Pure: no React, no I/O
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1_
  - [ ]* 5.2 Write property test: grouping partitions by race (Property 1)
    - **Property 1: Grouping partitions candidates exactly by race**
    - **Validates: Requirements 3.1**
    - New `client/src/lib/raceGroups.property.test.ts`; `numRuns: 100`; tag `Feature: all-ballot-candidates-by-office, Property 1`
  - [ ]* 5.3 Write property test: deterministic ordering (Property 2)
    - **Property 2: Grouping output is deterministically ordered**
    - **Validates: Requirements 3.2**
    - Tag `Feature: all-ballot-candidates-by-office, Property 2`; `numRuns: 100`
  - [ ]* 5.4 Write property test: filter soundness and completeness (Property 3)
    - **Property 3: Filters never surface a non-matching candidate**
    - **Validates: Requirements 3.4, 3.5, 3.6**
    - Tag `Feature: all-ballot-candidates-by-office, Property 3`; `numRuns: 100`
  - [ ]* 5.5 Write property test: empty result yields no groups (Property 4)
    - **Property 4: Empty result yields no groups**
    - **Validates: Requirements 3.7**
    - Tag `Feature: all-ballot-candidates-by-office, Property 4`; `numRuns: 100`
  - [ ]* 5.6 Write property test: headings preserve verbatim office/district (Property 5)
    - **Property 5: Group headings preserve verbatim office and district**
    - **Validates: Requirements 3.3, 4.1**
    - Tag `Feature: all-ballot-candidates-by-office, Property 5`; `numRuns: 100`
  - [ ]* 5.7 Write property test: same-group records share raw office/district (Property 9)
    - **Property 9: Same-race records share identical office and district**
    - **Validates: Requirements 2.4**
    - Tag `Feature: all-ballot-candidates-by-office, Property 9`; `numRuns: 100`

- [ ] 6. Render grouped candidates in the candidate list
  - [ ] 6.1 Convert CandidatesList to grouped rendering
    - In `client/src/features/voting/CandidatesList.tsx`, replace the flat `filtered` grid with `const groups = useMemo(() => groupCandidatesByRace(state.data ?? [], { query, party }), [state.data, query, party]);`
    - Keep the party-`<select>` options derived from the full dataset
    - Render each group as a `<section>` with a heading showing both office and district (e.g. `"{office} · {district}"`); render the existing card grid for `group.candidates` inside each group
    - When `groups.length === 0`, render the existing empty-state card ("No candidates match…")
    - Guard the per-card office label: show `office · district` only when `office` is a non-empty string, otherwise show district alone with no office label and no error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.4_
  - [ ] 6.2 Add race-group styles
    - Add `.raceGroup` and `.raceHeading` classes to `client/src/features/voting/Voting.module.css`, reusing existing `.grid`, `.candidateCard`, `.office`
    - _Requirements: 3.3_
  - [ ]* 6.3 Write component tests for CandidatesList
    - Renders a heading per race group containing both office and district; party filter shows only matching groups/candidates; no matches renders the empty-state message
    - _Requirements: 3.3, 3.5, 3.7_

- [ ] 7. Handle empty content in the candidate detail view
  - [ ] 7.1 Guard empty office, stances, and bio in CandidateDetail
    - In `client/src/features/voting/CandidateDetail.tsx`, render `office · district` only when `office` is non-empty; otherwise render district alone with no office label and no error
    - When `c.stances.length === 0`, render "Positions are not yet available for this candidate." instead of mapping an empty array
    - When `bio.simple === "" && bio.expert === ""`, render no placeholder or fabricated biography text (the biography area shows zero biography characters)
    - Leave the existing `website` guard (`c.website && (...)`) intact
    - _Requirements: 4.2, 4.3, 4.4, 5.6, 5.7_
  - [ ]* 7.2 Write component tests for CandidateDetail
    - A stance-less record shows the "positions not yet available" message; an empty-bio record renders no biography text and no placeholder; a record with empty office renders district only
    - _Requirements: 4.4, 5.6, 5.7_

- [ ] 8. Render every party label with a safe fallback
  - [ ] 8.1 Extend PartyBadge for the new members and unknown values
    - In `client/src/features/voting/PartyBadge.tsx`, add `"Socialism and Liberation": styles.psl` and `"Unenrolled": styles.ind` to the `PARTY_CLASS` map
    - Use `PARTY_CLASS[party] ?? styles.ind` and a label fallback (`typeof party === "string" && party.length > 0 ? party : "Unknown"`) so an out-of-union value renders a badge without throwing
    - _Requirements: 6.5, 6.6_
  - [ ] 8.2 Add the .psl badge style
    - Add a distinct `.psl` class (with its `[data-theme="dark"]` variant) to `client/src/features/voting/PartyBadge.module.css`
    - _Requirements: 6.5_
  - [ ]* 8.3 Write component tests for PartyBadge
    - Renders a visible label for each `Party` member including the two new ones; an out-of-union value renders a fallback badge without throwing
    - _Requirements: 6.5, 6.6_

- [ ] 9. Add cross-cutting parity and regression tests
  - [ ]* 9.1 Add the party-union parity test
    - Extend `server/src/domain/types.parity.property.test.ts` (or a sibling): extract `Party` union members from `server/src/domain/types.ts` and `client/src/types/domain.ts` and assert identical, equal-length member sets; add a companion assertion that `shape.ts`'s `PARTIES` array equals the client union member set
    - _Requirements: 7.1, 7.2, 7.4_
  - [ ]* 9.2 Add the quiz-scoring regression test
    - Extend `server/src/domain/quizScoring.test.ts`: for a fixed answer set the researched candidates (Healey, Minogue) keep their scores and ranking, and stance-less candidates score 0 and rank last
    - _Requirements: (Req 5 side effect)_

- [ ] 10. Final checkpoint - Run full build and test suites
  - Run the server and client build and test suites (vitest, non-watch) and fix any failures until both pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements and, where applicable, the design's numbered correctness properties for traceability.
- Property tests use `fast-check` with `numRuns: 100` and are tagged `Feature: all-ballot-candidates-by-office, Property N: <text>`.
- UI rendering concerns (headings, empty-state copy, badge colors, biography suppression) are covered by component tests rather than properties, per the design's testing strategy.
- The API route layer (`server/src/routes/data.ts`) needs no change — it already serves the whole array and single records.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["3.1", "5.1", "8.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "6.1", "7.1", "8.2", "9.1", "9.2"] },
    { "id": 4, "tasks": ["6.2", "6.3", "7.2", "8.3"] }
  ]
}
```
