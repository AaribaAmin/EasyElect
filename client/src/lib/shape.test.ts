import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateCandidate,
  validateTweet,
  validateTweetsResponse,
  type ShapeResult,
} from "./shape";

/**
 * Property 23: Client rejects shape-mismatched payloads.
 *
 * For any payload for a requested shape (Candidate, Tweet, TweetsResponse)
 * that is missing a required field, renames a required field, or supplies a
 * wrong-typed value, the shape validator classifies it invalid — returning
 * `{ valid: false }` with a type-mismatch error — rather than accepting it as
 * valid data.
 *
 * The strategy starts from a generated VALID payload (confirmed valid as a
 * sanity check), then applies a single generated mutation (drop a required
 * key, rename a required key, or retype a required field) and asserts the
 * validator rejects the result.
 *
 * **Validates: Requirements 9.4**
 */

const PARTIES = [
  "Democratic",
  "Republican",
  "Independent",
  "Libertarian",
  "Green-Rainbow",
  "Nonpartisan",
] as const;

const TWEET_TABS = ["recent", "notable", "needsContext", "interactions"] as const;

/** An `Explain` with both required string fields. */
const explainArb = fc.record({
  simple: fc.string(),
  expert: fc.string(),
});

/** A `SourceAttribution` with all three required string fields. */
const sourceArb = fc.record({
  name: fc.string(),
  url: fc.string(),
  reviewedOn: fc.string(),
});

/** A valid `CandidateStance` (source omitted — it is optional). */
const stanceArb = fc.record({
  issueId: fc.string(),
  position: fc.string(),
  detail: explainArb,
});

/** A valid `Candidate` payload (optional fields omitted). */
const candidateArb = fc.record({
  id: fc.string(),
  name: fc.string(),
  party: fc.constantFrom(...PARTIES),
  office: fc.string(),
  district: fc.string(),
  tagline: fc.string(),
  bio: explainArb,
  stances: fc.array(stanceArb, { maxLength: 3 }),
  source: sourceArb,
});

/** A valid `Tweet` payload (optional fields omitted). */
const tweetArb = fc.record({
  id: fc.string(),
  candidateId: fc.string(),
  authorName: fc.string(),
  authorHandle: fc.string(),
  text: fc.string(),
  date: fc.string(),
  likes: fc.integer(),
  reposts: fc.integer(),
  tabs: fc.array(fc.constantFrom(...TWEET_TABS), { maxLength: 4 }),
});

/** A valid `TweetsResponse` envelope. */
const tweetsResponseArb = fc.record({
  posts: fc.array(tweetArb, { maxLength: 3 }),
  source: fc.constantFrom("live", "cache", "fallback"),
});

/**
 * Required top-level keys per shape. Mutating any one of these (drop, rename,
 * or retype) must flip the validator to invalid. Optional keys are
 * deliberately excluded.
 */
const REQUIRED_KEYS = {
  candidate: [
    "id",
    "name",
    "party",
    "office",
    "district",
    "tagline",
    "bio",
    "stances",
    "source",
  ],
  tweet: [
    "id",
    "candidateId",
    "authorName",
    "authorHandle",
    "text",
    "date",
    "likes",
    "reposts",
    "tabs",
  ],
  tweetsResponse: ["posts", "source"],
} as const;

/**
 * A wrong-typed replacement for a field's current value: whatever the current
 * value is, pick a value of a different kind so the type no longer matches.
 * Strings/numbers/arrays/objects all get swapped to a disjoint-typed value.
 */
function wrongTypedValue(current: unknown): unknown {
  if (typeof current === "string") return 12345; // string field -> number
  if (typeof current === "number") return "not-a-number"; // number field -> string
  if (Array.isArray(current)) return "not-an-array"; // array field -> string
  if (current === null || typeof current === "object") return "not-an-object";
  return null;
}

type Mutation =
  | { kind: "drop"; key: string }
  | { kind: "rename"; key: string }
  | { kind: "retype"; key: string };

/** Build a mutation arbitrary over the required keys of a given shape. */
function mutationArb(requiredKeys: readonly string[]) {
  return fc.record({
    kind: fc.constantFrom("drop", "rename", "retype"),
    key: fc.constantFrom(...requiredKeys),
  }) as fc.Arbitrary<Mutation>;
}

/** Apply a single mutation to a fresh shallow clone of the valid payload. */
function applyMutation(
  valid: Record<string, unknown>,
  mutation: Mutation
): Record<string, unknown> {
  const mutated: Record<string, unknown> = { ...valid };
  switch (mutation.kind) {
    case "drop":
      delete mutated[mutation.key];
      break;
    case "rename": {
      const original = mutated[mutation.key];
      delete mutated[mutation.key];
      // A renamed field keeps its value but under a key the validator does
      // not recognise, so the required key is effectively absent.
      mutated[`${mutation.key}__renamed`] = original;
      break;
    }
    case "retype":
      mutated[mutation.key] = wrongTypedValue(mutated[mutation.key]);
      break;
  }
  return mutated;
}

/** Assert a result is an invalid, type-mismatch-carrying rejection. */
function expectRejected<T>(result: ShapeResult<T>): void {
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(typeof result.error).toBe("string");
    expect(result.error).toMatch(/Type mismatch at /);
  }
}

describe("shape validators — Property 23 (reject shape-mismatched payloads)", () => {
  it("validates well-formed Candidate payloads (sanity baseline)", () => {
    fc.assert(
      fc.property(candidateArb, (candidate) => {
        expect(validateCandidate(candidate).valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects any Candidate missing, renamed, or retyped required field", () => {
    fc.assert(
      fc.property(
        candidateArb,
        mutationArb(REQUIRED_KEYS.candidate),
        (candidate, mutation) => {
          const mutated = applyMutation(candidate, mutation);
          expectRejected(validateCandidate(mutated));
        }
      ),
      { numRuns: 300 }
    );
  });

  it("validates well-formed Tweet payloads (sanity baseline)", () => {
    fc.assert(
      fc.property(tweetArb, (tweet) => {
        expect(validateTweet(tweet).valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects any Tweet missing, renamed, or retyped required field", () => {
    fc.assert(
      fc.property(
        tweetArb,
        mutationArb(REQUIRED_KEYS.tweet),
        (tweet, mutation) => {
          const mutated = applyMutation(tweet, mutation);
          expectRejected(validateTweet(mutated));
        }
      ),
      { numRuns: 300 }
    );
  });

  it("validates well-formed TweetsResponse payloads (sanity baseline)", () => {
    fc.assert(
      fc.property(tweetsResponseArb, (response) => {
        expect(validateTweetsResponse(response).valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects any TweetsResponse missing, renamed, or retyped required field", () => {
    fc.assert(
      fc.property(
        tweetsResponseArb,
        mutationArb(REQUIRED_KEYS.tweetsResponse),
        (response, mutation) => {
          const mutated = applyMutation(response, mutation);
          expectRejected(validateTweetsResponse(mutated));
        }
      ),
      { numRuns: 300 }
    );
  });
});
