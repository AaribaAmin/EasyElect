import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Candidate, Party } from "../types/domain";
import {
  groupCandidatesByRace,
  type RaceFilters,
  type RaceGroup,
} from "./raceGroups";

/**
 * Property tests for the pure `groupCandidatesByRace` helper.
 *
 * Feature: all-ballot-candidates-by-office
 *
 * These exercise the partition/filter/ordering contract of the grouping helper
 * across randomized candidate lists and filters. Generators deliberately emit
 * whitespace and case variants of office/district/party/name so the
 * trim()+toLowerCase() normalization is stressed.
 */

const PARTIES: Party[] = [
  "Democratic",
  "Republican",
  "Independent",
  "Libertarian",
  "Green-Rainbow",
  "Nonpartisan",
  "Socialism and Liberation",
  "Unenrolled",
];

/** Trim + lowercase: the normalization the helper keys and orders on. */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

const KEY_SEPARATOR = "\u0000";

function raceKey(office: string, district: string): string {
  return normalize(office) + KEY_SEPARATOR + normalize(district);
}

/**
 * Wrap a base string with random leading/trailing whitespace and a random case
 * so two records that are "the same race" after normalization can still differ
 * byte-for-byte before it. Exercises the trim()+toLowerCase() path.
 */
function decorate(base: string, lead: string, trail: string, upper: boolean): string {
  const cased = upper ? base.toUpperCase() : base.toLowerCase();
  return `${lead}${cased}${trail}`;
}

const whitespaceArb = fc.constantFrom("", " ", "  ", "\t", " \t ");

/** Small pools keep collisions likely so groups actually contain >1 candidate. */
const OFFICE_POOL = ["Governor", "Attorney General", "Senator in Congress", "Auditor"];
const DISTRICT_POOL = ["Massachusetts", "Second District", "First District"];
const NAME_POOL = ["Alice Adams", "bob brown", "Carol Chase", "dave Dunn", "Eve East"];

/**
 * A single candidate with freely varied office/district/party/name, including
 * whitespace and case decoration on office/district. Used by Properties 1–5.
 */
const candidateArb: fc.Arbitrary<Candidate> = fc
  .record({
    base: fc.record({
      office: fc.constantFrom(...OFFICE_POOL),
      district: fc.constantFrom(...DISTRICT_POOL),
      name: fc.constantFrom(...NAME_POOL),
      party: fc.constantFrom(...PARTIES),
    }),
    officeLead: whitespaceArb,
    officeTrail: whitespaceArb,
    officeUpper: fc.boolean(),
    districtLead: whitespaceArb,
    districtTrail: whitespaceArb,
    districtUpper: fc.boolean(),
    idx: fc.integer({ min: 0, max: 100000 }),
  })
  .map(({ base, officeLead, officeTrail, officeUpper, districtLead, districtTrail, districtUpper, idx }): Candidate => ({
    id: `cand-${idx}-${base.name.replace(/\s+/g, "-")}`,
    name: base.name,
    party: base.party,
    office: decorate(base.office, officeLead, officeTrail, officeUpper),
    district: decorate(base.district, districtLead, districtTrail, districtUpper),
    tagline: "",
    bio: { simple: "", expert: "" },
    stances: [],
    source: {
      name: "Ballot",
      url: "https://example.test/ballot",
      reviewedOn: "2026-10-24",
    },
  }));

const candidatesArb: fc.Arbitrary<Candidate[]> = fc.array(candidateArb, {
  minLength: 0,
  maxLength: 12,
});

/**
 * Random filters. The query is sometimes empty, sometimes a lowercased
 * substring drawn from the candidate pool fields (so it has a real chance of
 * matching), sometimes arbitrary text. The party is sometimes "all", sometimes
 * a specific Party.
 */
function filtersArb(candidates: Candidate[]): fc.Arbitrary<RaceFilters> {
  const fieldFragments = candidates.flatMap((c) => [c.name, c.office, c.party, c.district]);
  const queryArb =
    fieldFragments.length > 0
      ? fc.oneof(
          fc.constant(""),
          fc.constantFrom(...fieldFragments).map((s) => s.slice(0, Math.max(1, Math.ceil(s.length / 2)))),
          fc.string({ maxLength: 5 })
        )
      : fc.oneof(fc.constant(""), fc.string({ maxLength: 5 }));
  const partyArb = fc.oneof(fc.constant<"all">("all"), fc.constantFrom(...PARTIES));
  return fc.record({ query: queryArb, party: partyArb });
}

/** Oracle: does this candidate pass both filters? Mirrors the helper's rule. */
function passesFilters(c: Candidate, filters: RaceFilters): boolean {
  const q = filters.query.trim().toLowerCase();
  const matchesParty = filters.party === "all" || c.party === filters.party;
  const matchesQuery =
    q === "" ||
    c.name.toLowerCase().includes(q) ||
    c.office.toLowerCase().includes(q) ||
    c.party.toLowerCase().includes(q) ||
    c.district.toLowerCase().includes(q);
  return matchesParty && matchesQuery;
}

/** Multiset signature of a candidate list keyed by id (ids are unique here). */
function idMultiset(candidates: Candidate[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of candidates) m.set(c.id, (m.get(c.id) ?? 0) + 1);
  return m;
}

function flattenGroups(groups: RaceGroup[]): Candidate[] {
  return groups.flatMap((g) => g.candidates);
}

const NO_OP_FILTER: RaceFilters = { query: "", party: "all" };

describe("Feature: all-ballot-candidates-by-office, Property 1: Grouping partitions candidates exactly by race", () => {
  it("under the no-op filter, groups form an exact partition keyed by normalized (office,district)", () => {
    fc.assert(
      fc.property(candidatesArb, (candidates) => {
        const groups = groupCandidatesByRace(candidates, NO_OP_FILTER);
        const flat = flattenGroups(groups);

        // Multiset of candidates across all groups equals the input multiset.
        expect(idMultiset(flat)).toEqual(idMultiset(candidates));

        // Within each group, every candidate shares the same normalized key.
        const groupKeys = groups.map((g) => {
          const keys = new Set(g.candidates.map((c) => raceKey(c.office, c.district)));
          expect(keys.size).toBe(1);
          return [...keys][0];
        });

        // Candidates in different groups have different keys (distinct keys).
        expect(new Set(groupKeys).size).toBe(groupKeys.length);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: all-ballot-candidates-by-office, Property 2: Grouping output is deterministically ordered", () => {
  it("groups are sorted by normalized office then district, and candidates within a group by name", () => {
    fc.assert(
      fc.property(candidatesArb, (candidates) => {
        const groups = groupCandidatesByRace(candidates, NO_OP_FILTER);

        // Groups ascending by normalized office, then normalized district.
        for (let i = 1; i < groups.length; i++) {
          const prev = groups[i - 1];
          const cur = groups[i];
          const officeCmp = normalize(prev.office).localeCompare(normalize(cur.office));
          if (officeCmp === 0) {
            expect(normalize(prev.district).localeCompare(normalize(cur.district))).toBeLessThanOrEqual(0);
          } else {
            expect(officeCmp).toBeLessThan(0);
          }
        }

        // Candidates within each group ascending (case-insensitive) by name.
        for (const g of groups) {
          for (let i = 1; i < g.candidates.length; i++) {
            const cmp = g.candidates[i - 1].name
              .toLowerCase()
              .localeCompare(g.candidates[i].name.toLowerCase());
            expect(cmp).toBeLessThanOrEqual(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: all-ballot-candidates-by-office, Property 3: Filters never surface a non-matching candidate", () => {
  it("every surfaced candidate passes both filters, and every passing candidate is surfaced", () => {
    fc.assert(
      fc.property(
        candidatesArb.chain((candidates) =>
          fc.record({ candidates: fc.constant(candidates), filters: filtersArb(candidates) })
        ),
        ({ candidates, filters }) => {
          const groups = groupCandidatesByRace(candidates, filters);
          const flat = flattenGroups(groups);

          // Soundness: no surfaced candidate fails either filter.
          for (const c of flat) {
            expect(passesFilters(c, filters)).toBe(true);
          }

          // Completeness: every candidate that passes both filters is surfaced.
          const surfaced = idMultiset(flat);
          const expected = idMultiset(candidates.filter((c) => passesFilters(c, filters)));
          expect(surfaced).toEqual(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: all-ballot-candidates-by-office, Property 4: Empty result yields no groups", () => {
  it("returns [] when no candidate matches both filters", () => {
    fc.assert(
      fc.property(
        candidatesArb,
        // A query guaranteed absent from every field: fields only use ASCII
        // letters/spaces, so a unicode sentinel can never be a substring.
        fc.constantFrom("\u2603zzz-no-match", "\uFFFFabsent", "###never###"),
        (candidates, impossibleQuery) => {
          // Sanity: the sentinel is not a substring of any generated field.
          const q = impossibleQuery.trim().toLowerCase();
          const anyMatch = candidates.some(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.office.toLowerCase().includes(q) ||
              c.party.toLowerCase().includes(q) ||
              c.district.toLowerCase().includes(q)
          );
          expect(anyMatch).toBe(false);

          const groups = groupCandidatesByRace(candidates, {
            query: impossibleQuery,
            party: "all",
          });
          expect(groups).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: all-ballot-candidates-by-office, Property 5: Group headings preserve verbatim office/district", () => {
  it("each group's office/district equals, byte-for-byte, some member's office/district", () => {
    fc.assert(
      fc.property(
        candidatesArb.chain((candidates) =>
          fc.record({ candidates: fc.constant(candidates), filters: filtersArb(candidates) })
        ),
        ({ candidates, filters }) => {
          const groups = groupCandidatesByRace(candidates, filters);
          for (const g of groups) {
            const officeMatch = g.candidates.some((c) => c.office === g.office);
            const districtMatch = g.candidates.some((c) => c.district === g.district);
            expect(officeMatch).toBe(true);
            expect(districtMatch).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 9 generator — approach (a): within any normalized race key, all raw
 * office/district values are identical. This reflects Req 2.4, the dataset
 * guarantee that same-race records carry byte-for-byte identical office and
 * district. We draw one decorated (raw) office/district per base race and reuse
 * it for every candidate that lands in that race, so the raw-equality invariant
 * is a faithful test of the real-world data contract rather than an artifact.
 */
const sameRaceCandidatesArb: fc.Arbitrary<Candidate[]> = fc
  .array(
    fc.record({
      officeBase: fc.constantFrom(...OFFICE_POOL),
      districtBase: fc.constantFrom(...DISTRICT_POOL),
      officeLead: whitespaceArb,
      officeTrail: whitespaceArb,
      officeUpper: fc.boolean(),
      districtLead: whitespaceArb,
      districtTrail: whitespaceArb,
      districtUpper: fc.boolean(),
    }),
    { minLength: 0, maxLength: 5 }
  )
  .chain((races) => {
    // Build one canonical raw (office,district) per normalized key.
    const rawByKey = new Map<string, { office: string; district: string }>();
    for (const r of races) {
      const office = decorate(r.officeBase, r.officeLead, r.officeTrail, r.officeUpper);
      const district = decorate(r.districtBase, r.districtLead, r.districtTrail, r.districtUpper);
      const key = raceKey(office, district);
      if (!rawByKey.has(key)) rawByKey.set(key, { office, district });
    }
    const rawRaces = [...rawByKey.values()];
    if (rawRaces.length === 0) return fc.constant<Candidate[]>([]);

    // Each candidate is assigned to one of the canonical raw races.
    return fc
      .array(
        fc.record({
          raceIdx: fc.integer({ min: 0, max: rawRaces.length - 1 }),
          name: fc.constantFrom(...NAME_POOL),
          party: fc.constantFrom(...PARTIES),
          idx: fc.integer({ min: 0, max: 100000 }),
        }),
        { minLength: 0, maxLength: 12 }
      )
      .map((specs) =>
        specs.map((s): Candidate => {
          const race = rawRaces[s.raceIdx];
          return {
            id: `cand-${s.idx}-${s.name.replace(/\s+/g, "-")}`,
            name: s.name,
            party: s.party,
            office: race.office,
            district: race.district,
            tagline: "",
            bio: { simple: "", expert: "" },
            stances: [],
            source: {
              name: "Ballot",
              url: "https://example.test/ballot",
              reviewedOn: "2026-10-24",
            },
          };
        })
      );
  });

describe("Feature: all-ballot-candidates-by-office, Property 9: Same-race records share identical office and district", () => {
  it("any two candidates in the same group have byte-for-byte equal raw office and district", () => {
    fc.assert(
      fc.property(sameRaceCandidatesArb, (candidates) => {
        const groups = groupCandidatesByRace(candidates, NO_OP_FILTER);
        for (const g of groups) {
          const offices = new Set(g.candidates.map((c) => c.office));
          const districts = new Set(g.candidates.map((c) => c.district));
          // Raw equality holds because the dataset guarantee (Req 2.4) makes
          // same-race records byte-for-byte identical in office and district.
          expect(offices.size).toBe(1);
          expect(districts.size).toBe(1);
        }
      }),
      { numRuns: 100 }
    );
  });
});
