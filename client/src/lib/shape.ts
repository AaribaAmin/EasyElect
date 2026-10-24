/**
 * Runtime shape validation for Data_API payloads.
 *
 * The client types in `types/domain.ts` are a compile-time mirror of the
 * server domain shapes, but a Data_API response is just parsed JSON at
 * runtime — TypeScript cannot guarantee it actually matches the declared
 * shape. When a response is missing a required field, renames a field, or
 * carries a wrong-typed value, rendering it as valid data would silently show
 * broken or misleading content.
 *
 * These pure validators check a parsed payload against the client domain
 * shapes and return a discriminated result. On any mismatch they classify the
 * payload invalid and report a human-readable type-mismatch error naming the
 * offending field, so a consumer can surface the error instead of rendering
 * the payload as valid (Req 9.4).
 *
 * The functions are pure and exported (no React, no I/O) so they can be unit-
 * and property-tested in isolation (see the client shape-rejection property
 * test, Property 23).
 */
import type {
  Candidate,
  CandidateStance,
  Explain,
  Party,
  SourceAttribution,
  Tweet,
  TweetTab,
  TweetsResponse,
} from "../types/domain";

/**
 * Result of validating a payload against a client domain shape: either the
 * payload typed as the target shape, or an invalid result carrying a
 * type-mismatch error. Returning a discriminated result (rather than throwing)
 * lets callers surface the error in the UI while keeping control flow simple.
 */
export type ShapeResult<T> =
  | { valid: true; value: T }
  | { valid: false; error: string };

/** The allowed values of the `Party` union, mirrored from the domain type. */
const PARTIES: readonly Party[] = [
  "Democratic",
  "Republican",
  "Independent",
  "Libertarian",
  "Green-Rainbow",
  "Nonpartisan",
];

/** The allowed values of the `TweetTab` union, mirrored from the domain type. */
const TWEET_TABS: readonly TweetTab[] = [
  "recent",
  "notable",
  "needsContext",
  "interactions",
];

/** Build a type-mismatch error message naming the offending field/path. */
function mismatch(path: string, expected: string): string {
  return `Type mismatch at ${path}: expected ${expected}`;
}

/** True for a non-null, non-array plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate the `Explain` shape: `{ simple: string; expert: string }`.
 * Both fields are required and must be strings.
 */
function validateExplain(value: unknown, path: string): ShapeResult<Explain> {
  if (!isRecord(value)) return { valid: false, error: mismatch(path, "object") };
  if (typeof value.simple !== "string")
    return { valid: false, error: mismatch(`${path}.simple`, "string") };
  if (typeof value.expert !== "string")
    return { valid: false, error: mismatch(`${path}.expert`, "string") };
  return { valid: true, value: { simple: value.simple, expert: value.expert } };
}

/**
 * Validate the `SourceAttribution` shape:
 * `{ name: string; url: string; reviewedOn: string }`. All fields required.
 */
export function validateSourceAttribution(
  value: unknown,
  path = "source"
): ShapeResult<SourceAttribution> {
  if (!isRecord(value)) return { valid: false, error: mismatch(path, "object") };
  if (typeof value.name !== "string")
    return { valid: false, error: mismatch(`${path}.name`, "string") };
  if (typeof value.url !== "string")
    return { valid: false, error: mismatch(`${path}.url`, "string") };
  if (typeof value.reviewedOn !== "string")
    return { valid: false, error: mismatch(`${path}.reviewedOn`, "string") };
  return {
    valid: true,
    value: { name: value.name, url: value.url, reviewedOn: value.reviewedOn },
  };
}

/**
 * Validate the `CandidateStance` shape:
 * `{ issueId: string; position: string; detail: Explain; source?: SourceAttribution }`.
 * `source` is optional; when present it must itself be a valid
 * `SourceAttribution`.
 */
export function validateCandidateStance(
  value: unknown,
  path = "stance"
): ShapeResult<CandidateStance> {
  if (!isRecord(value)) return { valid: false, error: mismatch(path, "object") };
  if (typeof value.issueId !== "string")
    return { valid: false, error: mismatch(`${path}.issueId`, "string") };
  if (typeof value.position !== "string")
    return { valid: false, error: mismatch(`${path}.position`, "string") };

  const detail = validateExplain(value.detail, `${path}.detail`);
  if (!detail.valid) return detail;

  const stance: CandidateStance = {
    issueId: value.issueId,
    position: value.position,
    detail: detail.value,
  };

  if (value.source !== undefined) {
    const source = validateSourceAttribution(value.source, `${path}.source`);
    if (!source.valid) return source;
    stance.source = source.value;
  }

  return { valid: true, value: stance };
}

/**
 * Validate the `Candidate` shape against the client domain type. Required
 * fields: `id`, `name`, `party` (from the `Party` union), `office`,
 * `district`, `tagline`, `bio` (Explain), `stances` (CandidateStance[]),
 * `source` (SourceAttribution). Optional: `website`, `handle` (strings when
 * present). A missing, renamed, or wrong-typed field yields a type-mismatch
 * error.
 */
export function validateCandidate(
  value: unknown,
  path = "candidate"
): ShapeResult<Candidate> {
  if (!isRecord(value)) return { valid: false, error: mismatch(path, "object") };

  for (const key of [
    "id",
    "name",
    "office",
    "district",
    "tagline",
  ] as const) {
    if (typeof value[key] !== "string")
      return { valid: false, error: mismatch(`${path}.${key}`, "string") };
  }

  if (typeof value.party !== "string" || !PARTIES.includes(value.party as Party))
    return {
      valid: false,
      error: mismatch(`${path}.party`, `one of Party (${PARTIES.join(", ")})`),
    };

  const bio = validateExplain(value.bio, `${path}.bio`);
  if (!bio.valid) return bio;

  if (!Array.isArray(value.stances))
    return { valid: false, error: mismatch(`${path}.stances`, "CandidateStance[]") };
  const stances: CandidateStance[] = [];
  for (let i = 0; i < value.stances.length; i++) {
    const stance = validateCandidateStance(
      value.stances[i],
      `${path}.stances[${i}]`
    );
    if (!stance.valid) return stance;
    stances.push(stance.value);
  }

  const source = validateSourceAttribution(value.source, `${path}.source`);
  if (!source.valid) return source;

  if (value.website !== undefined && typeof value.website !== "string")
    return { valid: false, error: mismatch(`${path}.website`, "string") };
  if (value.handle !== undefined && typeof value.handle !== "string")
    return { valid: false, error: mismatch(`${path}.handle`, "string") };

  const candidate: Candidate = {
    id: value.id as string,
    name: value.name as string,
    party: value.party as Party,
    office: value.office as string,
    district: value.district as string,
    tagline: value.tagline as string,
    bio: bio.value,
    stances,
    source: source.value,
  };
  if (value.website !== undefined) candidate.website = value.website as string;
  if (value.handle !== undefined) candidate.handle = value.handle as string;

  return { valid: true, value: candidate };
}

/**
 * Validate the `Tweet` shape against the client domain type. Required fields:
 * `id`, `candidateId`, `authorName`, `authorHandle`, `text`, `date` (strings),
 * `likes`, `reposts` (finite numbers), `tabs` (TweetTab[]). Optional:
 * `context` (Explain), `inReplyTo`, `sourceUrl` (strings). A missing, renamed,
 * or wrong-typed field yields a type-mismatch error.
 */
export function validateTweet(value: unknown, path = "tweet"): ShapeResult<Tweet> {
  if (!isRecord(value)) return { valid: false, error: mismatch(path, "object") };

  for (const key of [
    "id",
    "candidateId",
    "authorName",
    "authorHandle",
    "text",
    "date",
  ] as const) {
    if (typeof value[key] !== "string")
      return { valid: false, error: mismatch(`${path}.${key}`, "string") };
  }

  for (const key of ["likes", "reposts"] as const) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]))
      return { valid: false, error: mismatch(`${path}.${key}`, "number") };
  }

  if (!Array.isArray(value.tabs))
    return { valid: false, error: mismatch(`${path}.tabs`, "TweetTab[]") };
  for (let i = 0; i < value.tabs.length; i++) {
    const tab = value.tabs[i];
    if (typeof tab !== "string" || !TWEET_TABS.includes(tab as TweetTab))
      return {
        valid: false,
        error: mismatch(`${path}.tabs[${i}]`, `one of TweetTab (${TWEET_TABS.join(", ")})`),
      };
  }

  const tweet: Tweet = {
    id: value.id as string,
    candidateId: value.candidateId as string,
    authorName: value.authorName as string,
    authorHandle: value.authorHandle as string,
    text: value.text as string,
    date: value.date as string,
    likes: value.likes as number,
    reposts: value.reposts as number,
    tabs: value.tabs as TweetTab[],
  };

  if (value.context !== undefined) {
    const context = validateExplain(value.context, `${path}.context`);
    if (!context.valid) return context;
    tweet.context = context.value;
  }
  if (value.inReplyTo !== undefined) {
    if (typeof value.inReplyTo !== "string")
      return { valid: false, error: mismatch(`${path}.inReplyTo`, "string") };
    tweet.inReplyTo = value.inReplyTo;
  }
  if (value.sourceUrl !== undefined) {
    if (typeof value.sourceUrl !== "string")
      return { valid: false, error: mismatch(`${path}.sourceUrl`, "string") };
    tweet.sourceUrl = value.sourceUrl;
  }

  return { valid: true, value: tweet };
}

/**
 * Validate the `TweetsResponse` envelope:
 * `{ posts: Tweet[]; source: "live" | "cache" | "fallback" }`. Every post must
 * itself be a valid `Tweet`; a missing, renamed, or wrong-typed field (or an
 * out-of-union `source`) yields a type-mismatch error.
 */
export function validateTweetsResponse(
  value: unknown,
  path = "tweetsResponse"
): ShapeResult<TweetsResponse> {
  if (!isRecord(value)) return { valid: false, error: mismatch(path, "object") };

  if (!Array.isArray(value.posts))
    return { valid: false, error: mismatch(`${path}.posts`, "Tweet[]") };
  const posts: Tweet[] = [];
  for (let i = 0; i < value.posts.length; i++) {
    const post = validateTweet(value.posts[i], `${path}.posts[${i}]`);
    if (!post.valid) return post;
    posts.push(post.value);
  }

  if (
    value.source !== "live" &&
    value.source !== "cache" &&
    value.source !== "fallback"
  )
    return {
      valid: false,
      error: mismatch(`${path}.source`, "one of PostsSource (live, cache, fallback)"),
    };

  return { valid: true, value: { posts, source: value.source } };
}

/**
 * Validate an array of `Tweet` payloads (the current `GET /api/tweets`
 * response shape). Returns the first type-mismatch encountered so the UI can
 * surface it and avoid rendering the payload as valid.
 */
export function validateTweetList(
  value: unknown,
  path = "tweets"
): ShapeResult<Tweet[]> {
  if (!Array.isArray(value))
    return { valid: false, error: mismatch(path, "Tweet[]") };
  const tweets: Tweet[] = [];
  for (let i = 0; i < value.length; i++) {
    const tweet = validateTweet(value[i], `${path}[${i}]`);
    if (!tweet.valid) return tweet;
    tweets.push(tweet.value);
  }
  return { valid: true, value: tweets };
}

/**
 * Validate an array of `Candidate` payloads (the `GET /api/candidates`
 * response). Returns the first type-mismatch encountered so the UI can surface
 * it and avoid rendering the payload as valid.
 */
export function validateCandidateList(
  value: unknown,
  path = "candidates"
): ShapeResult<Candidate[]> {
  if (!Array.isArray(value))
    return { valid: false, error: mismatch(path, "Candidate[]") };
  const candidates: Candidate[] = [];
  for (let i = 0; i < value.length; i++) {
    const candidate = validateCandidate(value[i], `${path}[${i}]`);
    if (!candidate.valid) return candidate;
    candidates.push(candidate.value);
  }
  return { valid: true, value: candidates };
}
