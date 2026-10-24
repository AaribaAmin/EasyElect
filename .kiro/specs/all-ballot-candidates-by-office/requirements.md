# Requirements Document

## Introduction

Easy Elect currently serves only two candidates (the two gubernatorial candidates) from `server/src/domain/candidates.ts`. This feature expands the curated dataset to include every candidate appearing on the official Massachusetts state-election ballot sample, organizes those candidates by the race/office they are contesting, and surfaces the race grouping and the office each candidate is running for in the Voting section of the client.

The authoritative source for the full ballot is the Massachusetts Secretary of the Commonwealth sample ballot (reviewed 2026-10-24): `https://www.sec.state.ma.us/WhereDoIVoteMA/ShowBallot/ViewMyBallot/BallotOut/ST/154/0/1?ipid=promo-link-block1`.

Most newly added candidates do not yet have researched biographies, stances, or secondary sources. Because Easy Elect's data-integrity rules forbid fabricating positions or attributions, this feature defines a minimum viable candidate record: real identity and office data drawn directly from the official ballot, with narrative fields left empty rather than invented. The feature also extends the `Party` affiliation model to represent ballot affiliations not currently supported ("Socialism and Liberation" and "Unenrolled"), and keeps the server and client domain type definitions synchronized.

## Glossary

- **Ballot_Dataset**: The curated array of `Candidate` records served by the API, defined in `server/src/domain/candidates.ts`.
- **Candidate_Record**: A single `Candidate` object in the Ballot_Dataset.
- **Race**: A single contest on the ballot for one office within one jurisdiction, e.g. "Attorney General" or "Senator in General Court, Hampshire, Franklin & Worcester District".
- **Office**: The position a candidate seeks, stored in `Candidate.office`, e.g. "Senator in Congress".
- **District**: The jurisdiction or seat qualifier for a Race, stored in `Candidate.district`, e.g. "Second District" or "Franklin County".
- **Party_Type**: The `Party` union type defined in `server/src/domain/types.ts` and mirrored in `client/src/types/domain.ts`.
- **Minimum_Viable_Record**: A Candidate_Record populated with ballot-verifiable identity and office data, whose unresearched narrative fields follow the empty-value rules in Requirement 5.
- **Source_Attribution**: The `SourceAttribution` object (`name`, `url`, `reviewedOn`) recording where a record's information originated.
- **Official_Ballot_Source**: The Massachusetts Secretary of the Commonwealth sample-ballot URL that serves as the attribution for ballot-derived identity and office data.
- **Voting_Section**: The client Voting feature UI, primarily `client/src/features/voting/CandidatesList.tsx` and `CandidateDetail.tsx`.
- **Server_Domain_Types**: The type definitions in `server/src/domain/types.ts`.
- **Client_Domain_Types**: The type definitions in `client/src/types/domain.ts`.

## Requirements

### Requirement 1: Include every ballot candidate in the dataset

**User Story:** As a voter, I want every candidate on the official state-election ballot to appear in Easy Elect, so that I can learn about everyone I can actually vote for.

#### Acceptance Criteria

1. THE Ballot_Dataset SHALL contain exactly one Candidate_Record for each individual candidate listed on the Official_Ballot_Source (the MA Secretary of the Commonwealth sample ballot reviewed 2026-10-24), with no Candidate_Record whose `name` does not match a candidate on the Official_Ballot_Source.
2. THE Ballot_Dataset SHALL retain the existing Candidate_Records for Maura Healey and Mike Minogue with their current `id` values unchanged.
3. WHERE a Race lists a ticket of two named people for Governor and Lieutenant Governor, THE Ballot_Dataset SHALL represent that ticket as a single Candidate_Record consistent with the existing gubernatorial records, such that the Governor Race contains no more than one Candidate_Record per ticket.
4. THE Ballot_Dataset SHALL assign each Candidate_Record a non-empty `id` that is unique within the Ballot_Dataset, such that no two Candidate_Records share the same `id`.
5. THE Ballot_Dataset SHALL set each Candidate_Record `name` to the candidate name exactly as printed on the Official_Ballot_Source, with no added, omitted, or reordered name components.
6. IF a candidate listed on the Official_Ballot_Source has no corresponding Candidate_Record in the Ballot_Dataset, THEN THE Ballot_Dataset SHALL be treated as incomplete and SHALL be rejected by the dataset validation check with an indication identifying the missing candidate name.

### Requirement 2: Preserve office and district for every candidate

**User Story:** As a voter, I want each candidate tagged with the office and jurisdiction they are running for, so that candidates can be organized by race.

#### Acceptance Criteria

1. THE Ballot_Dataset SHALL set the `office` field of each Candidate_Record to the non-empty office name (1 to 120 characters) named by that candidate's Race on the Official_Ballot_Source.
2. THE Ballot_Dataset SHALL set the `district` field of each Candidate_Record to the non-empty jurisdiction or seat qualifier (1 to 120 characters) named by that candidate's Race on the Official_Ballot_Source.
3. WHERE a Race has no district qualifier on the Official_Ballot_Source, THE Ballot_Dataset SHALL set `district` to the exact string "Massachusetts".
4. WHERE two or more Candidate_Records contest the same Race, THE Ballot_Dataset SHALL assign those records byte-for-byte identical `office` and `district` values.
5. IF a Candidate_Record's Race has no office named on the Official_Ballot_Source, THEN THE Ballot_Dataset SHALL exclude that Candidate_Record from the dataset and record an error indicating the office is missing, retaining all other Candidate_Records.

### Requirement 3: Group candidates by race in the candidate list

**User Story:** As a voter, I want the candidate list grouped by race, so that I can see who is competing for the same office together.

#### Acceptance Criteria

1. THE Voting_Section SHALL group the displayed candidates into Race groups, where each group contains exactly the Candidate_Records whose `office` and `district` field values are equal (compared case-insensitively after trimming surrounding whitespace).
2. THE Voting_Section SHALL order Race groups alphabetically (case-insensitive, ascending) by office and, within the same office, by district, and SHALL order Candidate_Records within each group alphabetically (case-insensitive, ascending) by candidate name.
3. THE Voting_Section SHALL display a heading for each Race group that contains both the office value and the district value of that group.
4. WHEN a user applies the existing search filter, THE Voting_Section SHALL display only the Race groups containing at least one Candidate_Record whose name, office, party, or district contains the search text (case-insensitive), and within each displayed group SHALL display only the Candidate_Records that match the search text.
5. WHEN a user applies the existing party filter to a party value other than "all", THE Voting_Section SHALL display only the Race groups containing at least one Candidate_Record whose party equals the selected party, and within each displayed group SHALL display only the Candidate_Records whose party equals the selected party.
6. WHEN both the search filter and the party filter are active, THE Voting_Section SHALL display only the Candidate_Records that satisfy both filters and SHALL display only the Race groups containing at least one such Candidate_Record.
7. IF no Candidate_Record satisfies the active filters, THEN THE Voting_Section SHALL display no Race groups and SHALL display an empty-state message indicating that no candidates match the current filters.

### Requirement 4: Show the office a candidate is running for

**User Story:** As a voter, I want to see what each candidate is running for, so that I understand the role at stake when I view a candidate.

#### Acceptance Criteria

1. WHEN the candidate list is rendered, THE Voting_Section SHALL display, on each Candidate_Record's entry, the verbatim `office` value served by the API for that Candidate_Record, with no truncation or transformation of its characters.
2. WHEN a candidate detail view is rendered, THE Voting_Section SHALL display both the verbatim `office` value and the verbatim `district` value served by the API for that Candidate_Record.
3. WHEN a candidate detail view is rendered, THE Voting_Section SHALL display the `office` string identical to the `office` value served by the API for that Candidate_Record, with no added, removed, or reordered characters.
4. IF the `office` value served by the API for a Candidate_Record is absent or an empty string, THEN THE Voting_Section SHALL render that candidate's entry without displaying an office label and without producing a rendering error.

### Requirement 5: Data integrity for records without researched content

**User Story:** As a voter who trusts Easy Elect's accuracy, I want unresearched candidate records to show only verified ballot facts, so that the app never presents invented positions or biographies.

#### Acceptance Criteria

1. WHERE a Candidate_Record has no researched stance tied to a resolvable source, THE Ballot_Dataset SHALL set that record's `stances` to an empty list containing zero elements.
2. WHERE a Candidate_Record has no researched biography, THE Ballot_Dataset SHALL set both the `simple` and `expert` fields of `bio` to an empty string of zero length.
3. THE Ballot_Dataset SHALL set the `source` of every Minimum_Viable_Record to a Source_Attribution whose `url` equals the Official_Ballot_Source and whose `reviewedOn` equals the ballot review date "2026-10-24".
4. IF a Candidate_Record has no verified website URL, THEN THE Ballot_Dataset SHALL omit the `website` field from that record.
5. IF a Candidate_Record has no verified handle, THEN THE Ballot_Dataset SHALL omit the `handle` field from that record.
6. WHEN a candidate detail view renders a Candidate_Record whose `stances` list contains zero elements, THE Voting_Section SHALL display a message indicating that positions are not yet available for that candidate.
7. WHEN a candidate detail view renders a Candidate_Record whose `bio.simple` and `bio.expert` fields are both empty strings of zero length, THE Voting_Section SHALL render the biography area with zero characters of biography text and with no placeholder or fabricated biography text.

### Requirement 6: Represent ballot party affiliations

**User Story:** As a voter, I want each candidate's actual ballot affiliation shown, so that the party label reflects what appears on the official ballot.

#### Acceptance Criteria

1. THE Party_Type SHALL include a member representing the "Socialism and Liberation" affiliation that is a distinct value not equal to any existing Party_Type member.
2. THE Party_Type SHALL include a member representing the "Unenrolled" affiliation that is a distinct value not equal to any existing Party_Type member.
3. WHEN the Ballot_Dataset sets the `party` of a Candidate_Record, THE Ballot_Dataset SHALL set it to exactly one Party_Type member equal to the affiliation printed for that candidate on the Official_Ballot_Source.
4. IF a candidate's printed affiliation on the Official_Ballot_Source matches no Party_Type member, THEN THE Ballot_Dataset SHALL exclude that Candidate_Record and record an error identifying the unmatched affiliation.
5. WHEN the Voting_Section displays the party label of a Candidate_Record, THE Voting_Section SHALL render a visible label for every Party_Type member, including "Socialism and Liberation" and "Unenrolled".
6. IF a Candidate_Record's `party` value is not a Party_Type member, THEN THE Voting_Section SHALL render a fallback label without producing a rendering error.

### Requirement 7: Keep server and client domain types in sync

**User Story:** As a developer, I want the server and client candidate types to stay identical, so that the client validates and renders the expanded dataset without shape mismatches.

#### Acceptance Criteria

1. THE Client_Domain_Types SHALL define the `Party` union with a member set identical to the `Party` union in the Server_Domain_Types, such that no member appears in only one of the two definitions.
2. WHEN a member is added to, removed from, or renamed in the `Party` union of the Server_Domain_Types, THE Client_Domain_Types `Party` union SHALL be updated in the same change so that both definitions list identical, equal-length member sets.
3. THE Client_Domain_Types SHALL define the `Candidate`, `CandidateStance`, and `SourceAttribution` interfaces with field-name sets, required-versus-optional markings, and field types matching the corresponding interfaces in the Server_Domain_Types, such that no field appears in only one definition.
4. WHEN the client validates a candidate payload containing every Candidate_Record in the Ballot_Dataset, THE client SHALL return a valid result that accepts every Candidate_Record with no type-mismatch error and preserves the record count and order.
5. IF a candidate payload contains a Candidate_Record with a missing, renamed, or wrong-typed field, THEN THE client SHALL return an invalid result carrying a type-mismatch error that names the offending field path and SHALL NOT render the payload as valid.
