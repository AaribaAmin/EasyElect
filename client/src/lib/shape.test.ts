import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateCandidate,
  validateNewsItem,
  validateTweetsResponse,
  type ShapeResult,
} from "./shape";

/**
 * Property 23: Client rejects shape-mismatched payloads.
 *
 * For any payload for a requested shape (Candidate, News_Item, TweetsResponse)
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
 * **Validates: Requirements 2.3, 2.4**
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

/** A non-empty string (the News_Item required string fields reject ""). */
const nonEmptyStringArb = fc.string({ minLength: 1 });

/**
 * A valid `News_Item` payload (optional `context` omitted). Every required
 * string field is non-empty, `candidateIds` is a non-empty array of non-empty
 * strings, and `tabs` is a non-empty array drawn from the `TweetTab` union.
 */
const newsItemArb = fc.record({
  id: nonEmptyStringArb,
  candidateIds: fc.array(nonEmptyStringArb, { minLength: 1, maxLength: 3 }),
  title: nonEmptyStringArb,
  outlet: nonEmptyStringArb,
  url: nonEmptyStringArb,
  date: nonEmptyStringArb,
  tabs: fc.array(fc.constantFrom(...TWEET_TABS), { minLength: 1, maxLength: 4 }),
});

/** A valid `TweetsResponse` envelope. */
const tweetsResponseArb = fc.record({
  posts: fc.array(newsItemArb, { maxLength: 3 }),
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
  newsItem: ["id", "candidateIds", "title", "outlet", "url", "date", "tabs"],
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

/** A concrete, known-valid News_Item used by the targeted unit tests. */
function validNewsItem(): Record<string, unknown> {
  return {
    id: "news-1",
    candidateIds: ["healey", "minogue"],
    title: "Governor signs budget",
    outlet: "Boston Globe",
    url: "https://example.com/article",
    date: "2024-07-01",
    tabs: ["recent", "interactions"],
  };
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

  it("validates well-formed News_Item payloads (sanity baseline)", () => {
    fc.assert(
      fc.property(newsItemArb, (item) => {
        expect(validateNewsItem(item).valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects any News_Item missing, renamed, or retyped required field", () => {
    fc.assert(
      fc.property(
        newsItemArb,
        mutationArb(REQUIRED_KEYS.newsItem),
        (item, mutation) => {
          const mutated = applyMutation(item, mutation);
          expectRejected(validateNewsItem(mutated));
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

describe("validateNewsItem — targeted rejection cases", () => {
  it("accepts a valid News_Item (optional context omitted)", () => {
    const result = validateNewsItem(validNewsItem());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.id).toBe("news-1");
      expect(result.value.candidateIds).toEqual(["healey", "minogue"]);
      expect(result.value.tabs).toEqual(["recent", "interactions"]);
    }
  });

  it("accepts a valid News_Item with a well-formed optional context", () => {
    const item = {
      ...validNewsItem(),
      context: { simple: "plain take", expert: "detailed take" },
    };
    const result = validateNewsItem(item);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.context).toEqual({
      simple: "plain take",
      expert: "detailed take",
    });
  });

  it("rejects a non-object payload", () => {
    expectRejected(validateNewsItem(null));
    expectRejected(validateNewsItem("not-an-object"));
    expectRejected(validateNewsItem([]));
  });

  for (const key of ["id", "title", "outlet", "url", "date"] as const) {
    it(`rejects when required string field "${key}" is missing`, () => {
      const item = validNewsItem();
      delete item[key];
      expectRejected(validateNewsItem(item));
    });

    it(`rejects when required string field "${key}" is renamed`, () => {
      const item = validNewsItem();
      item[`${key}X`] = item[key];
      delete item[key];
      expectRejected(validateNewsItem(item));
    });

    it(`rejects when required string field "${key}" is an empty string`, () => {
      const item = { ...validNewsItem(), [key]: "" };
      expectRejected(validateNewsItem(item));
    });

    it(`rejects when required string field "${key}" is wrong-typed`, () => {
      const item = { ...validNewsItem(), [key]: 123 };
      expectRejected(validateNewsItem(item));
    });
  }

  it("rejects when candidateIds is missing", () => {
    const item = validNewsItem();
    delete item.candidateIds;
    expectRejected(validateNewsItem(item));
  });

  it("rejects when candidateIds is empty", () => {
    expectRejected(validateNewsItem({ ...validNewsItem(), candidateIds: [] }));
  });

  it("rejects when candidateIds is not an array", () => {
    expectRejected(
      validateNewsItem({ ...validNewsItem(), candidateIds: "healey" })
    );
  });

  it("rejects when candidateIds contains a non-string", () => {
    expectRejected(
      validateNewsItem({ ...validNewsItem(), candidateIds: ["healey", 7] })
    );
  });

  it("rejects when candidateIds contains an empty string", () => {
    expectRejected(
      validateNewsItem({ ...validNewsItem(), candidateIds: ["healey", ""] })
    );
  });

  it("rejects when tabs is missing", () => {
    const item = validNewsItem();
    delete item.tabs;
    expectRejected(validateNewsItem(item));
  });

  it("rejects when tabs is empty", () => {
    expectRejected(validateNewsItem({ ...validNewsItem(), tabs: [] }));
  });

  it("rejects when tabs is not an array", () => {
    expectRejected(validateNewsItem({ ...validNewsItem(), tabs: "recent" }));
  });

  it("rejects when tabs contains a value outside the TweetTab union", () => {
    expectRejected(
      validateNewsItem({ ...validNewsItem(), tabs: ["recent", "trending"] })
    );
  });

  it("rejects when optional context is present but malformed", () => {
    // Missing `expert`.
    expectRejected(
      validateNewsItem({ ...validNewsItem(), context: { simple: "s" } })
    );
    // Wrong-typed `simple`.
    expectRejected(
      validateNewsItem({
        ...validNewsItem(),
        context: { simple: 1, expert: "e" },
      })
    );
    // Not an object.
    expectRejected(
      validateNewsItem({ ...validNewsItem(), context: "context" })
    );
  });
});

describe("validateTweetsResponse — targeted rejection cases", () => {
  it("accepts a valid envelope", () => {
    const result = validateTweetsResponse({
      posts: [validNewsItem()],
      source: "fallback",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.source).toBe("fallback");
      expect(result.value.posts).toHaveLength(1);
    }
  });

  it("accepts an empty posts array", () => {
    const result = validateTweetsResponse({ posts: [], source: "live" });
    expect(result.valid).toBe(true);
  });

  it("rejects when posts is not an array", () => {
    expectRejected(
      validateTweetsResponse({ posts: "nope", source: "live" })
    );
  });

  it("rejects when posts is missing", () => {
    expectRejected(validateTweetsResponse({ source: "live" }));
  });

  it("rejects when a post is invalid", () => {
    const badPost = { ...validNewsItem(), title: "" };
    expectRejected(
      validateTweetsResponse({ posts: [validNewsItem(), badPost], source: "live" })
    );
  });

  it("rejects when source is out of the PostsSource union", () => {
    expectRejected(
      validateTweetsResponse({ posts: [], source: "archive" })
    );
  });

  it("rejects when source is missing", () => {
    expectRejected(validateTweetsResponse({ posts: [] }));
  });
});
