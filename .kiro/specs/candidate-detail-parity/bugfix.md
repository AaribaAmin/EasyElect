# Bugfix Requirements Document

## Introduction

The candidate dataset in `server/src/domain/candidates.ts` only fully describes two of its 24 records: Maura Healey (`maura-healey`) and Mike Minogue (`mike-minogue`), both running for Governor of Massachusetts. Each of those two records carries a non-empty `tagline`, a `bio` with both `simple` and `expert` copy, a per-candidate `source` attribution, and a set of issue `stances` where every stance has a `position`, a dual-variant `detail`, and its own resolvable HTTP/HTTPS `source`.

The other 22 records are Minimum_Viable_Records drawn from the Massachusetts Secretary of the Commonwealth sample ballot (reviewed 2026-10-24). They carry identity fields only — `id`, `name`, `party`, `office`, `district` — with an empty `tagline`, an empty `bio` (both `simple` and `expert` are `""`), an empty `stances: []`, no `website` or `handle`, and the shared generic `OFFICIAL_BALLOT_SOURCE`. As a result, the app presents most candidates with no substantive detail: their detail pages show no biography, no tagline, and no issue positions.

This bugfix extends every non-template candidate to the same structural level of detail as the Healey/Minogue template, while preserving the project's no-fabrication rule — every bio and stance must be tied to a real, resolvable source — and keeping all existing dataset invariants and property-based tests passing.

## Bug Analysis

### Current Behavior (Defect)

The defect is that every candidate other than Healey and Minogue is a content-empty Minimum_Viable_Record, so the app has no substantive detail to present for them.

1.1 WHEN a candidate record other than `maura-healey` or `mike-minogue` is served THEN the system presents it with an empty `tagline` (`""`)

1.2 WHEN a candidate record other than `maura-healey` or `mike-minogue` is served THEN the system presents it with an empty `bio`, where both `bio.simple` and `bio.expert` are `""`

1.3 WHEN a candidate record other than `maura-healey` or `mike-minogue` is served THEN the system presents it with an empty `stances` array (`[]`), so no issue positions are shown

1.4 WHEN a candidate record other than `maura-healey` or `mike-minogue` is served THEN the system presents it with the shared generic `OFFICIAL_BALLOT_SOURCE` attribution rather than a per-candidate source, and with no `website` or `handle`

### Expected Behavior (Correct)

Each affected candidate reaches structural parity with the Healey/Minogue template, and every added field is backed by a real, resolvable source.

2.1 WHEN a candidate record other than `maura-healey` or `mike-minogue` is served THEN the system SHALL present a non-empty `tagline` for that candidate

2.2 WHEN a candidate record other than `maura-healey` or `mike-minogue` is served THEN the system SHALL present a `bio` whose `simple` and `expert` strings are both non-empty

2.3 WHEN a candidate record other than `maura-healey` or `mike-minogue` is served THEN the system SHALL present a non-empty `stances` array in which each stance has an `issueId` drawn from the supported Issue_Set (housing, education, guns, healthcare, climate, transit), a non-empty `position`, a `detail` whose `simple` and `expert` strings are both non-empty, and at most one stance per `issueId`

2.4 WHEN a candidate record other than `maura-healey` or `mike-minogue` is served THEN the system SHALL present a per-candidate `source` attribution with a non-empty `name`, a resolvable HTTP/HTTPS `url`, and a `reviewedOn` date, in place of the shared generic ballot source; and each stance SHALL carry its own `source` with a non-empty `name` and a resolvable HTTP/HTTPS `url`

2.5 WHEN narrative content (a bio claim or an issue stance) for a candidate cannot be tied to a real, resolvable source documenting a position that candidate actually proposed or stated THEN the system SHALL omit that content rather than infer or fabricate it, consistent with the project's no-fabrication rule

### Unchanged Behavior (Regression Prevention)

The two template records, the dataset's structural invariants, and the no-fabrication contract must all survive the change. Note that once a former Minimum_Viable_Record is given a real per-candidate `source`, it is no longer a Minimum_Viable_Record (its `source.url` no longer equals the ballot URL), so the MVR-emptiness invariant below applies only to records that still carry the generic ballot source.

3.1 WHEN the `maura-healey` and `mike-minogue` records are served THEN the system SHALL CONTINUE TO present their existing taglines, bios, stances, and sources unchanged

3.2 WHEN any candidate record is served THEN the system SHALL CONTINUE TO expose the existing identity fields (`id`, `name`, `party`, `office`, `district`) with their current values, preserving ballot roster membership and office/district assignments

3.3 WHEN the dataset is loaded THEN the system SHALL CONTINUE TO hold unique `id` values across all candidates and SHALL CONTINUE TO satisfy the existing stance-validity invariants (valid `issueId`, non-empty detail variants, valid stance source, at most one stance per issueId)

3.4 WHEN a record still carries the shared generic `OFFICIAL_BALLOT_SOURCE` (its `source.url` equals the sample ballot URL) THEN the system SHALL CONTINUE TO present that record with an empty `bio` (both variants `""`), an empty `stances` array, and no `website` or `handle`, so the Minimum_Viable_Record no-fabrication invariant still holds for any record left unresearched

3.5 WHEN the existing property-based test suites run (candidate validity, stance validity, and Minimum_Viable_Record emptiness) THEN the system SHALL CONTINUE TO pass them all

## Bug Condition

**Key definitions**
- **F**: the candidate dataset as it exists before the fix (22 of 24 records are content-empty Minimum_Viable_Records).
- **F'**: the candidate dataset after the fix (non-template records extended to template parity with real, sourced content).

**Bug Condition** — identifies the records that trigger the defect:

```pascal
FUNCTION isBugCondition(C)
  INPUT: C of type Candidate
  OUTPUT: boolean

  // A record triggers the bug when it is neither template record yet
  // carries no substantive detail: empty tagline, empty bio, no stances.
  RETURN C.id <> "maura-healey"
     AND C.id <> "mike-minogue"
     AND (isEmpty(C.tagline)
          OR (isEmpty(C.bio.simple) AND isEmpty(C.bio.expert))
          OR length(C.stances) = 0)
END FUNCTION
```

**Property — Fix Checking** (desired behavior for every buggy record):

```pascal
// For every record that triggered the bug, the fixed dataset gives it
// template-level detail, every piece backed by a resolvable source.
FOR ALL C WHERE isBugCondition(C) DO
  C' ← F'(C)
  ASSERT isNonEmpty(C'.tagline)
  ASSERT isNonEmpty(C'.bio.simple) AND isNonEmpty(C'.bio.expert)
  ASSERT length(C'.stances) > 0
  ASSERT isResolvableHttpUrl(C'.source.url)
         AND C'.source.url <> OFFICIAL_BALLOT_SOURCE_URL
  FOR ALL s IN C'.stances DO
    ASSERT s.issueId IN {housing, education, guns, healthcare, climate, transit}
    ASSERT isNonEmpty(s.position)
    ASSERT isNonEmpty(s.detail.simple) AND isNonEmpty(s.detail.expert)
    ASSERT isResolvableHttpUrl(s.source.url)
  END FOR
  ASSERT atMostOneStancePerIssue(C'.stances)
END FOR
```

**Property — Preservation Checking** (non-buggy records are unchanged):

```pascal
// The two template records are not buggy inputs, so the fix must leave
// them byte-for-byte identical.
FOR ALL C WHERE NOT isBugCondition(C) DO
  ASSERT F(C) = F'(C)
END FOR
```
