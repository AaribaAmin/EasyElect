import type { Candidate, Party } from "./types.js";

/**
 * The canonical ballot roster: name + office + district + party, drawn from the
 * Official_Ballot_Source (Massachusetts Secretary of the Commonwealth sample
 * ballot, reviewed 2026-10-24). This is the single source the completeness
 * check verifies the dataset against (Req 1.1, Req 1.6).
 *
 * Entries are matched to Candidate_Records by `name`, so the names here are
 * byte-for-byte identical to the verbatim ballot names used in
 * `candidates.ts`. The Independent Governor ticket is named "James and
 * Kittredge" (surname-only ticket as printed on the official ballot).
 */
export interface BallotEntry {
  name: string;
  office: string;
  district: string;
  party: Party;
}

export const OFFICIAL_BALLOT_ROSTER: readonly BallotEntry[] = [
  // Governor — Massachusetts
  { name: "Maura Healey", office: "Governor", district: "Massachusetts", party: "Democratic" },
  { name: "Mike Minogue", office: "Governor", district: "Massachusetts", party: "Republican" },
  { name: "James and Kittredge", office: "Governor", district: "Massachusetts", party: "Independent" },

  // Senator in Congress — Massachusetts
  { name: "Edward J. Markey", office: "Senator in Congress", district: "Massachusetts", party: "Democratic" },
  { name: "John Deaton", office: "Senator in Congress", district: "Massachusetts", party: "Republican" },
  { name: "Shiva Ayyadurai", office: "Senator in Congress", district: "Massachusetts", party: "Independent" },
  { name: "Joe Tache", office: "Senator in Congress", district: "Massachusetts", party: "Socialism and Liberation" },

  // Attorney General — Massachusetts
  { name: "Andrea Joy Campbell", office: "Attorney General", district: "Massachusetts", party: "Democratic" },
  { name: "Michael C. Walsh", office: "Attorney General", district: "Massachusetts", party: "Republican" },

  // Secretary of State — Massachusetts
  { name: "William Francis Galvin", office: "Secretary of State", district: "Massachusetts", party: "Democratic" },
  { name: "Anne R. Brensley", office: "Secretary of State", district: "Massachusetts", party: "Republican" },

  // Treasurer — Massachusetts
  { name: "Deborah B. Goldberg", office: "Treasurer", district: "Massachusetts", party: "Democratic" },
  { name: "Elizabeth Dionne", office: "Treasurer", district: "Massachusetts", party: "Republican" },

  // Auditor — Massachusetts
  { name: "Diana DiZoglio", office: "Auditor", district: "Massachusetts", party: "Democratic" },
  { name: "Al Ozonoff", office: "Auditor", district: "Massachusetts", party: "Libertarian" },

  // Representative in Congress — Second District
  { name: "James P. McGovern", office: "Representative in Congress", district: "Second District", party: "Democratic" },

  // Councillor — Eighth District
  { name: "Tara J. Jacobs", office: "Councillor", district: "Eighth District", party: "Democratic" },

  // Senator in General Court — Hampshire, Franklin & Worcester District
  {
    name: "Joanne M. Comerford",
    office: "Senator in General Court",
    district: "Hampshire, Franklin & Worcester District",
    party: "Democratic",
  },

  // Representative in General Court — First Franklin District
  {
    name: "Lora L. Wondolowski",
    office: "Representative in General Court",
    district: "First Franklin District",
    party: "Democratic",
  },
  {
    name: "Amy E. LaVallee",
    office: "Representative in General Court",
    district: "First Franklin District",
    party: "Unenrolled",
  },

  // District Attorney — Northwestern District
  { name: "David E. Sullivan", office: "District Attorney", district: "Northwestern District", party: "Democratic" },

  // Register of Probate — Franklin County
  { name: "Daniel Francis Graves", office: "Register of Probate", district: "Franklin County", party: "Democratic" },

  // Sheriff (Vacancy) — Franklin County
  { name: "Lori M. Streeter", office: "Sheriff (Vacancy)", district: "Franklin County", party: "Democratic" },
  { name: "Gary Edward Gagnon", office: "Sheriff (Vacancy)", district: "Franklin County", party: "Independent" },
  { name: "Jon J. Hall", office: "Sheriff (Vacancy)", district: "Franklin County", party: "Unenrolled" },

  // Council of Governments Executive Committee — Franklin County
  {
    name: "Jane M. Peirce",
    office: "Council of Governments Executive Committee",
    district: "Franklin County",
    party: "Unenrolled",
  },
];

/** Result of checking the dataset against the official ballot roster. */
export interface DatasetCompleteness {
  /** True only when both `missing` and `extra` are empty. */
  complete: boolean;
  /** Ballot names with no matching Candidate_Record (Req 1.6). */
  missing: string[];
  /** Record names not present on the official ballot (Req 1.1). */
  extra: string[];
}

/**
 * Check the dataset against the official ballot roster, matching by `name`.
 *
 * - `missing`: ballot names for which no dataset record exists (Req 1.6).
 * - `extra`: dataset record names that are not on the official ballot (Req 1.1).
 * - `complete`: true only when both lists are empty.
 *
 * Defaults `roster` to {@link OFFICIAL_BALLOT_ROSTER} when not provided.
 */
export function checkDatasetCompleteness(
  dataset: Candidate[],
  roster: readonly BallotEntry[] = OFFICIAL_BALLOT_ROSTER,
): DatasetCompleteness {
  const datasetNames = new Set(dataset.map((c) => c.name));
  const rosterNames = new Set(roster.map((entry) => entry.name));

  const missing = roster
    .map((entry) => entry.name)
    .filter((name) => !datasetNames.has(name));

  const extra = dataset
    .map((c) => c.name)
    .filter((name) => !rosterNames.has(name));

  return {
    complete: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}
