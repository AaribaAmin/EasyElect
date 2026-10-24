/**
 * Pure race-grouping helper for the Voting section.
 *
 * Partitions a flat candidate list into race groups keyed by office+district
 * (compared case-insensitively after trimming), applies the active search and
 * party filters, and returns the groups in deterministic order. No React, no
 * I/O — all ordering and partition logic is unit- and property-testable in
 * isolation. (Req 3.1–3.7, 4.1)
 */
import type { Candidate, Party } from "../types/domain";

export interface RaceGroup {
  /** Display office (verbatim from the first candidate in the group). */
  office: string;
  /** Display district (verbatim from the first candidate in the group). */
  district: string;
  /** Candidates in the race, ordered case-insensitively by name. */
  candidates: Candidate[];
}

export interface RaceFilters {
  /** Free-text search over name/office/party/district (case-insensitive). */
  query: string;
  /** "all" or a specific Party. */
  party: "all" | Party;
}

/** Trim surrounding whitespace and lowercase, for case-insensitive comparison. */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** NUL separator avoids key collisions between e.g. ("ab","c") and ("a","bc"). */
const KEY_SEPARATOR = "\u0000";

function raceKey(candidate: Candidate): string {
  return normalize(candidate.office) + KEY_SEPARATOR + normalize(candidate.district);
}

/**
 * Partition candidates into deterministically ordered race groups, applying the
 * party and query filters. A candidate must pass both filters to survive.
 * Returns `[]` when no candidate survives. (Req 3.1–3.7, 4.1)
 */
export function groupCandidatesByRace(
  candidates: Candidate[],
  filters: RaceFilters
): RaceGroup[] {
  const { party } = filters;
  const q = filters.query.trim().toLowerCase();

  // 1. Filter by both the party filter and the query filter.
  const surviving = candidates.filter((c) => {
    const matchesParty = party === "all" || c.party === party;
    const matchesQuery =
      q === "" ||
      c.name.toLowerCase().includes(q) ||
      c.office.toLowerCase().includes(q) ||
      c.party.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q);
    return matchesParty && matchesQuery;
  });

  // 2. Key surviving candidates by normalized office + district.
  const byKey = new Map<string, Candidate[]>();
  for (const c of surviving) {
    const key = raceKey(c);
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.push(c);
    } else {
      byKey.set(key, [c]);
    }
  }

  // 3. Within each group, sort candidates case-insensitively ascending by name.
  //    5. Carry the verbatim office/district from the first post-sort member.
  const groups: RaceGroup[] = [];
  for (const bucket of byKey.values()) {
    const sorted = [...bucket].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    const first = sorted[0];
    groups.push({
      office: first.office,
      district: first.district,
      candidates: sorted,
    });
  }

  // 4. Across groups, sort by normalized office then normalized district.
  groups.sort((a, b) => {
    const officeCmp = normalize(a.office).localeCompare(normalize(b.office));
    if (officeCmp !== 0) return officeCmp;
    return normalize(a.district).localeCompare(normalize(b.district));
  });

  // 6. Empty result → no groups.
  return groups;
}
