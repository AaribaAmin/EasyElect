# Candidate Detail Parity Bugfix Design

## Overview

Only two of the 24 records in `server/src/domain/candidates.ts` — `maura-healey` and `mike-minogue` — carry substantive detail. Those two are the structural template: a non-empty `tagline`, a `bio` with both `simple` and `expert` copy, a per-candidate `source`, optional `website`/`handle`, and a `stances` array where each stance has an `issueId` from the supported Issue_Set, a `position`, a dual-variant `detail`, and its own resolvable HTTP/HTTPS `source`. The other 22 records are Minimum_Viable_Records (MVRs): identity fields only, empty narrative, and the shared generic `OFFICIAL_BALLOT_SOURCE`. Their detail pages show no bio, no tagline, no issue positions.

The fix extends each non-template record toward template parity by researching real, sourced content for that candidate and writing it into the dataset. The work is bounded by one hard rule that is non-negotiable and already encoded in the project's tests and in `DATA_SOURCES.md`: **every bio claim and every stance must be tied to a real, resolvable source documenting a position the candidate actually proposed or stated. Content that cannot be sourced is omitted, never fabricated.**

Because sourcing is per-candidate and offices range from US Senate down to a county Council of Governments seat, some candidates will have abundant sources and others may have none that meet the bar. The design therefore treats "reach parity" as a best-effort-per-candidate goal with a well-defined fallback: a candidate for whom no resolvable sources can be found stays a Minimum_Viable_Record — it keeps the generic `OFFICIAL_BALLOT_SOURCE` and its empty fields — so the MVR-emptiness property test continues to hold for it. A record is only ever promoted out of MVR status (given a real per-candidate `source.url`) once it has researched, sourced content attached. This keeps the `source.url === OFFICIAL_BALLOT_SOURCE` keying that the MVR property test relies on exactly aligned with "has real content vs does not."

The change is confined to data and documentation: `candidates.ts` record fields and `DATA_SOURCES.md`. No runtime code, types, validation logic, or test files change, and the two template records are left byte-for-byte identical.

## Glossary

- **Bug_Condition (C)**: A record triggers the bug when it is neither `maura-healey` nor `mike-minogue` yet carries no substantive detail — empty `tagline`, both `bio` variants empty, or an empty `stances` array. (From `bugfix.md`.)
- **Property (P)**: The desired post-fix behavior for a buggy record that could be researched — a non-empty `tagline`, a non-empty dual-variant `bio`, a non-empty `stances` array, a per-candidate `source` whose `url` is a resolvable HTTP/HTTPS URL other than the ballot URL, and each stance carrying a valid `issueId`, non-empty `position`, non-empty dual-variant `detail`, and its own resolvable source, with at most one stance per `issueId`.
- **Preservation**: The two template records, every record's identity fields (`id`, `name`, `party`, `office`, `district`), the dataset-wide id-uniqueness and ballot-roster-membership invariants, the stance-validity invariants, and the MVR-emptiness invariant for any record left unresearched must all remain unchanged.
- **Minimum_Viable_Record (MVR)**: A record whose `source.url` equals the `OFFICIAL_BALLOT_SOURCE` URL. By invariant it has an empty `bio` (both variants `""`), empty `stances`, and no `website`/`handle`. Keyed entirely off `source.url`.
- **OFFICIAL_BALLOT_SOURCE**: The shared `SourceAttribution` constant in `candidates.ts` pointing at the Massachusetts Secretary of the Commonwealth sample ballot (`reviewedOn: "2026-10-24"`). Its `url` is the MVR discriminator used by `candidates.mvr.property.test.ts`.
- **Issue_Set**: The fixed set of supported `issueId` values: `housing`, `education`, `guns`, `healthcare`, `climate`, `transit`. A stance's `issueId` must be one of these.
- **candidates**: The exported `Candidate[]` in `server/src/domain/candidates.ts`, served by `GET /api/candidates` and `GET /api/candidates/:id`.
- **OFFICIAL_BALLOT_ROSTER**: The canonical name+office+district+party roster in `candidates.validation.ts`; `checkDatasetCompleteness` matches the dataset against it by `name`. Identity fields must not drift from this roster.

## Bug Details

### Bug Condition

The bug manifests for any record that is not one of the two template records yet carries no substantive detail. Such a record was imported verbatim from the sample ballot with only identity/office/district/party populated; its `tagline`, `bio`, and `stances` were intentionally left empty pending research, so the app has nothing substantive to present on its detail page.

**Formal Specification:**
```
FUNCTION isBugCondition(C)
  INPUT: C of type Candidate
  OUTPUT: boolean

  RETURN C.id <> "maura-healey"
     AND C.id <> "mike-minogue"
     AND (isEmpty(C.tagline)
          OR (isEmpty(C.bio.simple) AND isEmpty(C.bio.expert))
          OR length(C.stances) = 0)
END FUNCTION
```

### Examples

- `edward-j-markey` (Senator in Congress): before — `tagline: ""`, `bio: { simple: "", expert: "" }`, `stances: []`, `source: OFFICIAL_BALLOT_SOURCE`; detail page shows no bio, tagline, or positions. After — researched non-empty `tagline`/`bio`, one or more sourced stances, and a per-candidate `source` (e.g. his official Senate/campaign site), so the detail page renders substantive content.
- `andrea-joy-campbell` (Attorney General): before — empty narrative MVR. After — bio and stances tied to resolvable sources (official AG office pages, campaign site, news coverage), per-candidate `source`.
- `william-francis-galvin` (Secretary of State): before — empty narrative MVR. After — sourced bio and at least one sourced stance mapped onto an Issue_Set id.
- Edge case — a down-ballot candidate (e.g. `jane-m-peirce`, Council of Governments Executive Committee) for whom no resolvable source documents a stated position on any Issue_Set topic: the record stays a Minimum_Viable_Record (keeps `OFFICIAL_BALLOT_SOURCE` and empty fields). It continues to trigger `isBugCondition`, but omitting unsourceable content is the correct behavior under the no-fabrication rule, so the fix does not force content onto it.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The `maura-healey` and `mike-minogue` records stay byte-for-byte identical: existing taglines, bios, stances, and sources unchanged.
- Every record's identity fields (`id`, `name`, `party`, `office`, `district`) keep their current values, preserving ballot-roster membership and office/district assignments (`checkDatasetCompleteness` must still report complete with empty `missing`/`extra`).
- Dataset-wide `id` uniqueness is preserved; the record count stays 24 (no records added or removed).
- The stance-validity invariants hold for every stance written: valid `issueId` from the Issue_Set, non-empty `detail.simple`/`detail.expert`, a stance `source` with non-empty `name` and resolvable HTTP/HTTPS `url`, and at most one stance per `issueId`.
- Every `SourceAttribution.reviewedOn` stays a real ISO `YYYY-MM-DD` calendar date (Property 19). Newly written sources use the date they were actually verified.
- Any record left unresearched keeps the shared `OFFICIAL_BALLOT_SOURCE` and therefore keeps its empty `bio`, empty `stances`, and absent `website`/`handle`, so the MVR-emptiness invariant still holds for it.

**Scope:**
All inputs that are not candidate-record content changes are completely unaffected by this fix. This includes:
- Runtime server code, route handlers, and the `Candidate`/`SourceAttribution` type shapes in `types.ts` (and their client mirror).
- `candidates.validation.ts` and the `OFFICIAL_BALLOT_ROSTER` (identity source of truth — read, not modified).
- All existing test files (candidate validity, stance validity, MVR emptiness, dates, completeness) — their assertions and logic are unchanged; only the data they run against grows.

## Hypothesized Root Cause

This is a content-completeness defect, not a logic defect. The "root cause" is the deliberate state the records were left in, and the hypotheses are about what sourced content exists to fill them.

1. **Records were intentionally imported as Minimum_Viable_Records.** The 22 non-template records were pulled verbatim from the sample ballot with narrative fields empty and the shared `OFFICIAL_BALLOT_SOURCE`, pending per-candidate research. The fix is to perform that research and attach sourced content — not to change any code path.

2. **Sourcing availability varies sharply by office.** Statewide and federal candidates (Senator, AG, Secretary of State, Treasurer, Auditor, US Rep) are likely to have official sites, `.gov` pages, and news coverage. Local and county offices (General Court seats, DA, Register of Probate, Sheriff, Council of Governments) may have thin or no coverage. The design must tolerate candidates that cannot reach full parity.

3. **Issue mapping may not be clean.** A candidate's actual stated positions may not map neatly onto the six Issue_Set ids. A position must be mapped onto the closest valid `issueId` only when the source genuinely documents a stance on that issue; otherwise the stance is omitted rather than forced.

4. **Date discipline must be honored.** Each researched `source.reviewedOn` must be the real verification date in `YYYY-MM-DD`, keeping Property 19 green. (The ballot `reviewedOn` on records left as MVRs stays `2026-10-24`.)

## Correctness Properties

Property 1: Bug Condition - Researched candidates reach template parity

_For any_ record where the bug condition holds (isBugCondition returns true) **and for which resolvable sources were found**, the fixed dataset SHALL give that record a non-empty `tagline`, a `bio` whose `simple` and `expert` are both non-empty, a non-empty `stances` array in which each stance has an `issueId` from the Issue_Set (housing, education, guns, healthcare, climate, transit), a non-empty `position`, a `detail` whose `simple` and `expert` are both non-empty, and its own `source` with a non-empty `name` and a resolvable HTTP/HTTPS `url`, with at most one stance per `issueId`, and a per-candidate `source` whose `url` is a resolvable HTTP/HTTPS URL other than the `OFFICIAL_BALLOT_SOURCE` URL. A record for which no resolvable source documents a real stated position SHALL instead remain a Minimum_Viable_Record (keeping the `OFFICIAL_BALLOT_SOURCE` and its empty fields), per the no-fabrication rule.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Template records and dataset invariants unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns false) — i.e. the `maura-healey` and `mike-minogue` records — the fixed dataset SHALL produce the same result as the original, preserving those two records byte-for-byte. Across the whole dataset the fix SHALL further preserve: unchanged identity fields and ballot-roster membership for every record, dataset-wide id uniqueness, the stance-validity invariants, valid ISO `reviewedOn` dates, and the MVR-emptiness invariant for every record still keyed to the `OFFICIAL_BALLOT_SOURCE` URL.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `server/src/domain/candidates.ts`

**Target**: the 22 non-template records in the `candidates` array (everything after `maura-healey` and `mike-minogue`).

**Specific Changes**:

1. **Per-candidate research and sourcing (prerequisite for every content change).** For each non-template candidate, gather resolvable HTTP/HTTPS sources documenting positions the candidate actually proposed or stated. Preferred source types, in rough priority order:
   - Official campaign website.
   - Official government page for the office held/sought (`.gov` / `.mass.gov` / official `house.gov`/`senate.gov` pages).
   - Reputable news coverage quoting or reporting the candidate's stated positions.
   Record each source's real verification date for `reviewedOn` (`YYYY-MM-DD`).

2. **Promote a researched record out of MVR status.** For a candidate with at least one resolvable source, replace `source: OFFICIAL_BALLOT_SOURCE` with a per-candidate `SourceAttribution` (`name`, resolvable `url`, `reviewedOn`). This changes `source.url` away from the ballot URL, so the record is no longer an MVR and the MVR property test no longer applies to it.

3. **Fill narrative fields for researched records.** Set a non-empty `tagline`, and a `bio` with non-empty `simple` and `expert`, every claim backed by one of the gathered sources. Add optional `website` (and `handle`, when a real, attributable handle exists) when documented.

4. **Add sourced stances for researched records.** For each Issue_Set topic the candidate has genuinely stated a position on, add one stance: `issueId` from `{housing, education, guns, healthcare, climate, transit}`, a non-empty `position`, a `detail` with non-empty `simple` and `expert`, and its own `source` (non-empty `name`, resolvable HTTP/HTTPS `url`, real `reviewedOn`). At most one stance per `issueId`. Omit any issue the candidate has no sourceable position on.

5. **Leave unsourceable records as Minimum_Viable_Records.** For any candidate where no resolvable source documents a stated position, make no change: keep `source: OFFICIAL_BALLOT_SOURCE`, empty `tagline`/`bio`/`stances`, and no `website`/`handle`. Do not fabricate content to force parity.

6. **Do not touch the two template records or any identity field.** `maura-healey` and `mike-minogue` stay exactly as written. For every record, `id`, `name`, `party`, `office`, and `district` keep their current values (they must continue to match `OFFICIAL_BALLOT_ROSTER`).

7. **Batch the work by office tier** (see Testing Strategy for ordering). After each batch, run the server test suite so regressions surface immediately and the MVR count shrinks only as records are genuinely researched.

**File**: `server/src/domain/DATA_SOURCES.md`

8. **Reflect the dataset's new state in the operator guide.** The existing guidance ("verify each record against its `source.url`", "set `reviewedOn` to the day you verified", "omit rather than guess") already governs this work and needs no contradiction. Update it to:
   - Note that candidate records now carry per-candidate sources and stance-level sources for researched candidates, while any unresearched candidate intentionally remains a Minimum_Viable_Record on the shared `OFFICIAL_BALLOT_SOURCE`.
   - Keep the "How to update a dataset and its review date" steps authoritative for future refreshes (re-verify against `source.url`, update `reviewedOn`, drop unsourceable stances).
   - Leave the attribution-notice and content-removal sections unchanged except as needed to stay accurate.

### No changes

`server/src/domain/types.ts`, its client mirror, `candidates.validation.ts`, and all test files are read for reference only and are not modified by this fix.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first confirm the starting state and that the existing suite is green, then verify that researched records reach parity and that every invariant and template record is preserved as records are filled in batch by batch.

### Exploratory Bug Condition Checking

**Goal**: Confirm the defect and the starting invariants before changing content. Confirm the root-cause framing (these are deliberately empty MVRs, not a logic bug) so the fix is "attach sourced content," not "change code."

**Test Plan**: Run the existing server test suite against the unfixed dataset to establish the green baseline, and inspect the dataset to confirm exactly which records are MVRs.

**Test Cases**:
1. **Baseline suite green**: Run `candidates.test.ts`, `candidates.validity.property.test.ts`, `candidates.stance.property.test.ts`, `candidates.mvr.property.test.ts`, `candidates.dates.test.ts` on the unfixed dataset — all pass (baseline).
2. **MVR census**: Count records whose `source.url === OFFICIAL_BALLOT_SOURCE` URL — expect 22, confirming the 22 buggy records.
3. **Template records detail present**: Confirm `maura-healey` and `mike-minogue` have non-empty tagline/bio/stances (not buggy).
4. **Detail-page emptiness (manifestation)**: For a sample MVR (e.g. `edward-j-markey`), confirm empty `tagline`/`bio`/`stances` — the observable defect.

**Expected Counterexamples**:
- 22 records with empty `tagline`, empty `bio`, and `stances: []`, all sharing the ballot `source.url`.
- Cause: records were imported verbatim as Minimum_Viable_Records pending per-candidate research (no code defect).

### Fix Checking

**Goal**: Verify that for all buggy records that could be researched, the fixed dataset produces the expected template-parity behavior, and that records left unresearched correctly remain empty MVRs.

**Pseudocode:**
```
FOR ALL C WHERE isBugCondition(C) DO
  C' := fixedDataset(C)
  IF wasResearched(C') THEN            // source.url != OFFICIAL_BALLOT_SOURCE_URL
    ASSERT isNonEmpty(C'.tagline)
    ASSERT isNonEmpty(C'.bio.simple) AND isNonEmpty(C'.bio.expert)
    ASSERT length(C'.stances) > 0
    ASSERT isResolvableHttpUrl(C'.source.url)
    FOR ALL s IN C'.stances DO
      ASSERT s.issueId IN {housing, education, guns, healthcare, climate, transit}
      ASSERT isNonEmpty(s.position)
      ASSERT isNonEmpty(s.detail.simple) AND isNonEmpty(s.detail.expert)
      ASSERT isNonEmpty(s.source.name) AND isResolvableHttpUrl(s.source.url)
    END FOR
    ASSERT atMostOneStancePerIssue(C'.stances)
  ELSE                                  // left as a Minimum_Viable_Record
    ASSERT C'.source.url = OFFICIAL_BALLOT_SOURCE_URL
    ASSERT isEmpty(C'.bio.simple) AND isEmpty(C'.bio.expert)
    ASSERT length(C'.stances) = 0
    ASSERT C'.website IS undefined AND C'.handle IS undefined
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (the two template records), the fixed dataset equals the original; and that dataset-wide invariants and the MVR-emptiness invariant for any remaining MVR are unchanged.

**Pseudocode:**
```
FOR ALL C WHERE NOT isBugCondition(C) DO
  ASSERT originalDataset(C) = fixedDataset(C)   // maura-healey, mike-minogue
END FOR

// Dataset-wide, over the fixed dataset:
ASSERT uniqueIds(fixedDataset)
ASSERT checkDatasetCompleteness(fixedDataset).complete        // roster membership
ASSERT identityFieldsUnchanged(fixedDataset, originalDataset) // id/name/party/office/district
FOR ALL C WHERE C.source.url = OFFICIAL_BALLOT_SOURCE_URL DO
  ASSERT isEmpty(C.bio.simple) AND isEmpty(C.bio.expert)
  ASSERT length(C.stances) = 0
  ASSERT C.website IS undefined AND C.handle IS undefined
END FOR
```

**Testing Approach**: Property-based testing is the right fit for preservation here because the existing suites already quantify over the whole dataset via `fc.constantFrom(...candidates)`:
- The MVR property test asserts emptiness for every record still keyed to the ballot URL — it keeps the no-fabrication guarantee for unresearched records automatically and shrinks its guarded population only as records are genuinely promoted.
- The validity, stance, and date property tests generate across every record, catching any invalid `issueId`, empty detail, bad URL, or malformed date in newly written content.

**Test Plan**: Observe the green baseline first, then after each batch re-run the full suite; the two template records and all invariants must stay green while the MVR census drops only for genuinely researched records.

**Test Cases**:
1. **Template records unchanged**: `maura-healey` and `mike-minogue` are byte-for-byte identical before and after (spot-check plus suite).
2. **Roster membership preserved**: `checkDatasetCompleteness(candidates).complete === true`, `missing`/`extra` empty (`candidates.test.ts`).
3. **Identity fields preserved**: every record's `id`/`name`/`party`/`office`/`district` match the pre-fix values and `OFFICIAL_BALLOT_ROSTER`.
4. **MVR emptiness preserved for remaining MVRs**: every record still on the ballot URL keeps empty bio/stances and no website/handle (`candidates.mvr.property.test.ts`).

### Unit Tests

- Dataset size and id-uniqueness floor (`candidates.test.ts`): record count unchanged at 24, ids unique and non-empty.
- Ballot completeness (`candidates.test.ts`): dataset complete against `OFFICIAL_BALLOT_ROSTER`, exactly one record per roster entry.
- Spot-check a representative researched record per office tier for non-empty tagline/bio and at least one valid, sourced stance.

### Property-Based Tests

- `candidates.validity.property.test.ts` (Properties 7, 10, 17): every record structurally valid — non-empty unique id, party in the union, office/district within bounds, `source.url` either the ballot URL or a valid HTTP/HTTPS URL, non-empty `source.name`, valid optional `website`.
- `candidates.stance.property.test.ts` (Property 18): every newly added stance has a valid `issueId`, non-empty `detail` variants, a valid stance `source`, and at most one stance per `issueId`.
- `candidates.mvr.property.test.ts` (Property 8): every remaining Minimum_Viable_Record carries empty bio/stances and no website/handle; the "at least one MVR" guard still holds only if some records are intentionally left unresearched (if every record is researched, revisit that guard with the team).
- `candidates.dates.test.ts` (Property 19): every `reviewedOn` (candidate and stance sources) is a real ISO `YYYY-MM-DD` calendar date.

### Integration Tests

- Run the full server test suite (`npm test` in `server/`) after each office-tier batch, so regressions surface against the exact batch that introduced them.
- Verify `GET /api/candidates` and `GET /api/candidates/:id` serve the enriched records (a researched record returns its tagline, bio, stances, and sources end to end).
- Confirm the client renders a researched candidate's detail page with bio, tagline, and issue positions where it previously showed none.

### Batching plan (22 candidates across many offices)

Research and fill in office-tier batches, running the full suite after each so a regression is attributable to one batch:

1. **Statewide / federal (highest source availability)**: Senator in Congress (Markey, Deaton, Ayyadurai, Tache), Attorney General (Campbell, Walsh), Secretary of State (Galvin, Brensley), Treasurer (Goldberg, Dionne), Auditor (DiZoglio, Ozonoff), Representative in Congress (McGovern), and the Independent Governor ticket (James and Kittredge).
2. **District / legislative**: Councillor (Jacobs), Senator in General Court (Comerford), Representative in General Court (Wondolowski, LaVallee).
3. **County / local (lowest source availability, most likely to stay MVRs)**: District Attorney (Sullivan), Register of Probate (Graves), Sheriff (Streeter, Gagnon, Hall), Council of Governments Executive Committee (Peirce).

Within each candidate: find sources first, then write only what those sources support, map positions onto Issue_Set ids only when genuinely documented, and leave the record an MVR if nothing resolvable is found.
