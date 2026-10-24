# Implementation Plan

- [ ] 1. Establish the green baseline and confirm the 22 Minimum_Viable_Records
  - **Property 1: Bug Condition** - Non-template records are content-empty MVRs
  - **CRITICAL**: This is the exploratory baseline - it MUST pass on the UNFIXED dataset before any content changes
  - **DO NOT change any candidate content in this task** - only observe and confirm the starting state
  - **GOAL**: Surface and document the exact set of buggy records so every later batch is attributable
  - Run the full server test suite on the unfixed dataset: `candidates.test.ts`, `candidates.validity.property.test.ts`, `candidates.stance.property.test.ts`, `candidates.mvr.property.test.ts`, `candidates.dates.test.ts` (run via `npm test` in `server/`)
  - **EXPECTED OUTCOME**: All suites PASS (this is the green baseline to preserve)
  - MVR census: confirm exactly 22 records whose `source.url === OFFICIAL_BALLOT_SOURCE` URL, and that each has empty `tagline`, empty `bio.simple`/`bio.expert`, and `stances: []`
  - Template check: confirm `maura-healey` and `mike-minogue` carry non-empty tagline/bio/stances and are NOT in the MVR set
  - Manifestation check: confirm a sample MVR (e.g. `edward-j-markey`) shows empty `tagline`/`bio`/`stances` - the observable defect
  - Document the 22 buggy records (confirming this is a deliberate content gap, not a logic defect)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Confirm preservation baseline on the unfixed dataset
  - **Property 2: Preservation** - Template records and dataset invariants hold before the fix
  - **IMPORTANT**: Follow observation-first methodology - record the baseline these tests guarantee so later batches can prove no regression
  - Observe: `checkDatasetCompleteness(candidates).complete === true` with empty `missing`/`extra` on unfixed data
  - Observe: record count is 24, all `id` values unique and non-empty
  - Observe: `maura-healey` and `mike-minogue` fields (tagline, bio, stances, source) recorded as the byte-for-byte reference to preserve
  - Observe: every record's identity fields (`id`, `name`, `party`, `office`, `district`) match `OFFICIAL_BALLOT_ROSTER`
  - Observe: `candidates.mvr.property.test.ts` passes for all 22 MVRs; `candidates.dates.test.ts` passes for all `reviewedOn` dates
  - **EXPECTED OUTCOME**: All preservation observations PASS on the UNFIXED dataset (baseline to hold through every batch)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Batch 1 - Statewide / federal office candidates
  - Target records (highest source availability): Senator in Congress (Markey, Deaton, Ayyadurai, Tache), Attorney General (Campbell, Walsh), Secretary of State (Galvin, Brensley), Treasurer (Goldberg, Dionne), Auditor (DiZoglio, Ozonoff), Representative in Congress (McGovern), and the Independent Governor ticket (James and Kittredge)

  - [ ] 3.1 Research resolvable sources per candidate in Batch 1
    - For each candidate, gather resolvable HTTP/HTTPS sources documenting positions the candidate actually proposed or stated
    - Preferred source types in priority order: official campaign website, official government page (`.gov` / `.mass.gov` / `house.gov` / `senate.gov`), reputable news coverage quoting the candidate's stated positions
    - Record each source's real verification date for `reviewedOn` in `YYYY-MM-DD`
    - Map stated positions onto Issue_Set ids (`housing`, `education`, `guns`, `healthcare`, `climate`, `transit`) only when the source genuinely documents a stance on that issue
    - _Requirements: 2.4, 2.5_

  - [ ] 3.2 Promote researched Batch 1 records and fill content
    - For each candidate with at least one resolvable source, replace `source: OFFICIAL_BALLOT_SOURCE` with a per-candidate `SourceAttribution` (non-empty `name`, resolvable HTTP/HTTPS `url` other than the ballot URL, real `reviewedOn`)
    - Set a non-empty `tagline` and a `bio` with non-empty `simple` and `expert`, every claim backed by a gathered source; add optional `website`/`handle` only when documented
    - Add sourced stances: for each genuinely stated Issue_Set topic, one stance with a valid `issueId`, non-empty `position`, dual-variant non-empty `detail`, and its own `source` (non-empty `name`, resolvable URL, real `reviewedOn`); at most one stance per `issueId`
    - Leave any candidate with no resolvable source as a Minimum_Viable_Record (keep `OFFICIAL_BALLOT_SOURCE` and empty fields) - do not fabricate
    - Do not touch `maura-healey`/`mike-minogue` or any identity field (`id`, `name`, `party`, `office`, `district`)
    - _Bug_Condition: isBugCondition(C) for each Batch 1 record (not healey/minogue, empty tagline OR empty bio OR no stances)_
    - _Expected_Behavior: expectedBehavior(C') - non-empty tagline, dual-variant bio, sourced stances, per-candidate resolvable source from design_
    - _Preservation: template records, identity fields, id-uniqueness, stance-validity, and MVR-emptiness for unresearched records from design_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.3 Run the full server test suite after Batch 1
    - Run `npm test` in `server/`
    - **EXPECTED OUTCOME**: All suites PASS; MVR census drops only for genuinely researched Batch 1 records; template records and all invariants unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Batch 2 - District / legislative office candidates
  - Target records: Councillor (Jacobs), Senator in General Court (Comerford), Representative in General Court (Wondolowski, LaVallee)

  - [ ] 4.1 Research resolvable sources per candidate in Batch 2
    - Gather resolvable HTTP/HTTPS sources per candidate (official campaign site, official legislative/`.gov` page, reputable news coverage)
    - Record each source's real `reviewedOn` in `YYYY-MM-DD`; map positions onto Issue_Set ids only when genuinely documented
    - _Requirements: 2.4, 2.5_

  - [ ] 4.2 Promote researched Batch 2 records and fill content
    - Promote each sourced record out of MVR status with a per-candidate `SourceAttribution` (resolvable URL other than the ballot URL)
    - Fill non-empty `tagline`, dual-variant `bio`, and sourced stances (valid `issueId`, non-empty `position`, dual-variant `detail`, per-stance resolvable source, at most one stance per `issueId`)
    - Leave any unsourceable candidate as a Minimum_Viable_Record; do not fabricate; do not touch identity fields
    - _Bug_Condition: isBugCondition(C) for each Batch 2 record from design_
    - _Expected_Behavior: expectedBehavior(C') from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 4.3 Run the full server test suite after Batch 2
    - Run `npm test` in `server/`
    - **EXPECTED OUTCOME**: All suites PASS; MVR census drops only for genuinely researched Batch 2 records; invariants and template records unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Batch 3 - County / local office candidates
  - Target records (lowest source availability, most likely to stay MVRs): District Attorney (Sullivan), Register of Probate (Graves), Sheriff (Streeter, Gagnon, Hall), Council of Governments Executive Committee (Peirce)

  - [ ] 5.1 Research resolvable sources per candidate in Batch 3
    - Gather resolvable HTTP/HTTPS sources per candidate (official campaign site, official county/`.gov` page, reputable news coverage)
    - Record each source's real `reviewedOn` in `YYYY-MM-DD`; map positions onto Issue_Set ids only when genuinely documented
    - Expect some candidates to have no resolvable source - that is an acceptable outcome, not a failure
    - _Requirements: 2.4, 2.5_

  - [ ] 5.2 Promote researched Batch 3 records and leave unsourceable records as MVRs
    - Promote each sourced record out of MVR status with a per-candidate `SourceAttribution`; fill non-empty `tagline`, dual-variant `bio`, and sourced stances (valid `issueId`, non-empty `position`, dual-variant `detail`, per-stance resolvable source, at most one stance per `issueId`)
    - For any candidate where no resolvable source documents a stated position, make no change: keep `source: OFFICIAL_BALLOT_SOURCE`, empty `tagline`/`bio`/`stances`, and no `website`/`handle` (per the no-fabrication rule)
    - Do not touch `maura-healey`/`mike-minogue` or any identity field
    - _Bug_Condition: isBugCondition(C) for each Batch 3 record from design_
    - _Expected_Behavior: expectedBehavior(C') from design; the MVR fallback for unsourceable records_
    - _Preservation: MVR-emptiness invariant for records left on OFFICIAL_BALLOT_SOURCE from design_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 5.3 Run the full server test suite after Batch 3
    - Run `npm test` in `server/`
    - **EXPECTED OUTCOME**: All suites PASS; any record left as an MVR still passes `candidates.mvr.property.test.ts`; template records and invariants unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Update DATA_SOURCES.md to reflect the dataset's new state
  - Note that candidate records now carry per-candidate sources and stance-level sources for researched candidates, while any unresearched candidate intentionally remains a Minimum_Viable_Record on the shared `OFFICIAL_BALLOT_SOURCE`
  - Keep the "How to update a dataset and its review date" steps authoritative for future refreshes (re-verify against `source.url`, update `reviewedOn`, drop unsourceable stances)
  - Leave the attribution-notice and content-removal sections unchanged except as needed to stay accurate
  - _Requirements: 2.4, 2.5_

- [ ] 7. Final verification - full suite plus endpoint and client spot-checks
  - **Property 1: Expected Behavior** - Researched records reach template parity
  - **IMPORTANT**: Re-run the SAME suites from tasks 1-2 - do NOT write new tests; the existing property-based suites quantify over the whole dataset
  - Run the full server test suite (`npm test` in `server/`): candidate validity (Properties 7, 10, 17), stance validity (Property 18), MVR emptiness (Property 8), dates (Property 19), and dataset completeness (`candidates.test.ts`)
  - **EXPECTED OUTCOME**: All suites PASS - every researched record is template-valid, every remaining MVR is empty, all dates are valid ISO calendar dates
  - **Property 2: Preservation** - Template records and invariants unchanged
  - Confirm `maura-healey` and `mike-minogue` are byte-for-byte identical to the task-2 reference
  - Confirm `checkDatasetCompleteness(candidates).complete === true` with empty `missing`/`extra`, record count 24, unique ids, and identity fields matching `OFFICIAL_BALLOT_ROSTER`
  - Endpoint spot-check: `GET /api/candidates` and `GET /api/candidates/:id` serve a researched record's tagline, bio, stances, and sources end to end
  - Client spot-check: a researched candidate's detail page renders bio, tagline, and issue positions where it previously showed none
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_
