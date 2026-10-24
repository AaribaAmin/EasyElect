/**
 * Live posts provider.
 *
 * Mirrors the AI provider pattern: reads credentials from the environment,
 * fetches real posts from an external social API, and falls back gracefully
 * when live data is unavailable. Credentials never leave the server.
 *
 * This file is built up incrementally across tasks:
 *   - normalizeHandle (task 3.1)
 *   - raw-post mapper/filter (this task)
 *   - isLivePostsEnabled / fetchLivePosts (task 4.1)
 */

import type { Candidate, Tweet, TweetTab } from "../domain/types.js";

/**
 * Normalize a social handle for case-insensitive, @-insensitive comparison.
 *
 * Lowercases the input and strips at most one leading "@". The operation is
 * idempotent: applying it twice yields the same result as applying it once,
 * because a normalized handle has no leading "@" and no uppercase letters to
 * strip or lower on a second pass.
 */
export function normalizeHandle(handle: string): string {
  const lowered = handle.toLowerCase();
  return lowered.startsWith("@") ? lowered.slice(1) : lowered;
}

/**
 * A raw post as returned by the external social API, before mapping/filtering.
 *
 * This is the source-agnostic shape the provider expects; the concrete vendor
 * response is adapted into this shape before mapping. Only the fields the
 * mapper reads are declared — any additional personal fields the source may
 * carry are deliberately NOT part of this type and are never copied onto a
 * `Tweet` (data minimization, Req 11.5).
 *
 * Fields are intentionally permissive (optional / unknown-ish) so the mapper,
 * not the type system, is the single gate that decides whether a raw post is
 * complete and public enough to be served.
 */
export interface RawPost {
  /** Source-assigned post id. */
  id?: string;
  /** Public post content. */
  text?: string;
  /** Creation time as reported by the source (ISO 8601 preferred). */
  createdAt?: string;
  /** Resolvable link back to the original post, used as `sourceUrl`. */
  url?: string;
  /** Public display name of the author. */
  authorName?: string;
  /** Author handle, e.g. "@jane_for_ma" (matched to a candidate). */
  authorHandle?: string;
  /**
   * Whether the source confirms the post is publicly published. The mapper
   * requires an explicit `true`; any other value (false/undefined) is treated
   * as unconfirmed and the post is excluded (Req 11.1, 11.2). Both `isPublic`
   * and `public` are accepted to tolerate vendor naming differences.
   */
  isPublic?: boolean;
  public?: boolean;
  /** Engagement counts; coerced to finite non-negative integers. */
  likes?: number;
  reposts?: number;
}

/** Default tab assignment for a freshly fetched live post. */
const DEFAULT_TABS: TweetTab[] = ["recent"];

/** True when a value is a non-empty string after trimming. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Coerce a possibly-missing engagement count to a finite, non-negative integer. */
function toCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * Normalize a raw post's creation time to an ISO 8601 string. Falls back to
 * the current time when the source value is absent or unparseable, so the
 * mapped `Tweet.date` is always a valid ISO string.
 */
function toIsoDate(createdAt: unknown): string {
  if (isNonEmptyString(createdAt)) {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

/** True only when the source explicitly confirms public publication (Req 11.2). */
function isConfirmedPublic(raw: RawPost): boolean {
  return raw.isPublic === true || raw.public === true;
}

/**
 * Map a single raw external post to a `Tweet`, or return `null` if the post
 * must be dropped.
 *
 * A post is dropped when:
 *   - its public-publication status is not explicitly confirmed (Req 11.1, 11.2),
 *   - it is missing any required attribution field — `authorName`,
 *     `authorHandle`, or `sourceUrl` (the original post URL) — or its `text`
 *     is empty (Req 11.3, 11.4), or
 *   - its author handle matches no candidate handle (Req 4.5).
 *
 * The returned `Tweet` copies only the public author identity (`authorName`,
 * `authorHandle`) and public post content — no other personal fields are read
 * or stored (Req 11.5). The key set is a strict subset of the declared `Tweet`
 * fields.
 */
export function mapRawPost(
  raw: RawPost,
  candidates: readonly Candidate[]
): Tweet | null {
  // Req 11.1/11.2: only publicly published posts may be served.
  if (!isConfirmedPublic(raw)) return null;

  // Req 11.3/11.4: every served post must be fully attributed and have content.
  if (
    !isNonEmptyString(raw.text) ||
    !isNonEmptyString(raw.authorName) ||
    !isNonEmptyString(raw.authorHandle) ||
    !isNonEmptyString(raw.url) ||
    !isNonEmptyString(raw.id)
  ) {
    return null;
  }

  // Req 4.3/4.5: attribute to the candidate whose handle matches, else drop.
  const normalizedAuthor = normalizeHandle(raw.authorHandle);
  const candidate = candidates.find(
    (c) => isNonEmptyString(c.handle) && normalizeHandle(c.handle) === normalizedAuthor
  );
  if (!candidate) return null;

  // Req 4.2/4.4 + 11.5: build a Tweet from the allowed fields only.
  return {
    id: raw.id,
    candidateId: candidate.id,
    authorName: raw.authorName,
    authorHandle: raw.authorHandle,
    text: raw.text,
    date: toIsoDate(raw.createdAt),
    likes: toCount(raw.likes),
    reposts: toCount(raw.reposts),
    tabs: [...DEFAULT_TABS],
    sourceUrl: raw.url,
  };
}

/**
 * Map a batch of raw external posts to `Tweet`s, dropping any that fail the
 * public-publication, attribution, or handle-match checks (Req 4.5, 11.2,
 * 11.4). The result contains only fully attributed, publicly published posts
 * whose author matches a known candidate.
 */
export function mapRawPosts(
  rawPosts: readonly RawPost[],
  candidates: readonly Candidate[]
): Tweet[] {
  const mapped: Tweet[] = [];
  for (const raw of rawPosts) {
    const tweet = mapRawPost(raw, candidates);
    if (tweet) mapped.push(tweet);
  }
  return mapped;
}
/* ------------------------------------------------------------------------- *
 * Live fetch path (task 4.1)                                                  *
 *                                                                             *
 * Mirrors the AI provider: credentials are read only from process.env, the    *
 * built-in fetch is used (no SDK), and the function never throws — every      *
 * abnormal condition becomes a typed FetchOutcome so the route can decide     *
 * between serving cache and serving fallback.                                 *
 * ------------------------------------------------------------------------- */

/**
 * Outcome of a live fetch attempt, so the route can decide cache vs fallback.
 *
 * - `ok`: the external call succeeded and `posts` are already mapped + filtered
 *   (public-only, fully attributed, handle-matched) via {@link mapRawPosts}.
 * - `rateLimited`: the external API signalled a rate limit (HTTP 429 or a
 *   documented rate-limit signal).
 * - `failed`: a 10s timeout, a network error, or any other non-success
 *   response. The caller preserves the existing cache (Req 4.6, 7.2, 7.3).
 */
export type FetchOutcome =
  | { kind: "ok"; posts: Tweet[] }
  | { kind: "rateLimited" }
  | { kind: "failed" };

/** Name of the bearer-token environment variable (Live_Credentials). */
const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";

/** Hard timeout for a single live fetch attempt, in milliseconds (Req 4.6). */
const FETCH_TIMEOUT_MS = 10_000;

/** Maximum number of recent posts to request per configured account (Req 4.1). */
const MAX_POSTS_PER_ACCOUNT = 50;

/** Only posts published within this many days are requested (Req 4.1). */
const RECENT_WINDOW_DAYS = 30;

/**
 * X/Twitter v2-style recent-search endpoint. The provider is deliberately
 * source-agnostic — only the bearer-token auth scheme and the JSON response
 * shape adapted in {@link adaptRawResponse} are assumed, so the concrete vendor
 * can be swapped without changing the orchestration.
 */
const SEARCH_ENDPOINT = "https://api.twitter.com/2/tweets/search/recent";

/**
 * Dependencies the live fetch needs, injectable so tests can stub the network
 * and the clock/timeout without faking globals (task 4.2). Defaults bind to the
 * built-in `fetch` and real timers.
 */
export interface FetchLiveDeps {
  /** HTTP transport. Defaults to the global `fetch`. */
  fetchFn?: typeof fetch;
  /** Timeout budget in ms for a single attempt. Defaults to 10_000 (Req 4.6). */
  timeoutMs?: number;
  /** Schedules the abort. Defaults to the global `setTimeout`. */
  setTimeoutFn?: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Cancels a scheduled abort. Defaults to the global `clearTimeout`. */
  clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
}

/**
 * True when every required Live_Credentials var is present and non-empty.
 *
 * Reads the bearer token exclusively from `process.env` (Req 5.1) — never from
 * any client-supplied input — so credentials stay server-side. A whitespace-only
 * value is treated as absent.
 */
export function isLivePostsEnabled(): boolean {
  const token = process.env[BEARER_TOKEN_ENV];
  return isNonEmptyString(token);
}

/**
 * The subset of an X/Twitter v2-style search response the adapter reads.
 * Intentionally permissive: the adapter, not the type system, decides which
 * raw posts survive into {@link RawPost} and ultimately into a `Tweet`.
 */
interface RawApiResponse {
  data?: RawApiPost[];
  includes?: { users?: RawApiUser[] };
}

interface RawApiPost {
  id?: unknown;
  text?: unknown;
  created_at?: unknown;
  author_id?: unknown;
  possibly_sensitive?: unknown;
  public_metrics?: {
    like_count?: unknown;
    retweet_count?: unknown;
  };
}

interface RawApiUser {
  id?: unknown;
  name?: unknown;
  username?: unknown;
  protected?: unknown;
}

/** Narrow an unknown value to a trimmed non-empty string, else undefined. */
function asStringOrUndefined(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

/** Narrow an unknown value to a finite number, else undefined. */
function asNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Adapt a vendor response into the source-agnostic {@link RawPost} shape the
 * mapper understands. Author identity is resolved from the `includes.users`
 * side-list by `author_id`. Only fields the mapper reads are copied across
 * (data minimization, Req 11.5); anything else the vendor returns is dropped
 * here rather than carried into the pipeline.
 *
 * Public-publication status is set to `true` only when the vendor did not flag
 * the author account as protected and did not mark the post sensitive; any
 * uncertainty leaves it unset so the mapper excludes the post (Req 11.1, 11.2).
 */
function adaptRawResponse(body: RawApiResponse): RawPost[] {
  const posts = Array.isArray(body.data) ? body.data : [];
  const users = Array.isArray(body.includes?.users) ? body.includes!.users! : [];

  const usersById = new Map<string, RawApiUser>();
  for (const user of users) {
    const id = asStringOrUndefined(user.id);
    if (id) usersById.set(id, user);
  }

  const raws: RawPost[] = [];
  for (const post of posts) {
    const authorId = asStringOrUndefined(post.author_id);
    const author = authorId ? usersById.get(authorId) : undefined;
    const handle = author ? asStringOrUndefined(author.username) : undefined;
    const id = asStringOrUndefined(post.id);

    // A post is only treated as public when the author account is not protected
    // and the post is not flagged sensitive. Anything unconfirmed stays unset.
    const authorIsProtected = author?.protected === true;
    const sensitive = post.possibly_sensitive === true;
    const isPublic = !authorIsProtected && !sensitive ? true : undefined;

    raws.push({
      id,
      text: asStringOrUndefined(post.text),
      createdAt: asStringOrUndefined(post.created_at),
      // Resolvable link back to the original post, used as `sourceUrl`.
      url: handle && id ? `https://x.com/${handle}/status/${id}` : undefined,
      authorName: author ? asStringOrUndefined(author.name) : undefined,
      authorHandle: handle,
      isPublic,
      likes: asNumberOrUndefined(post.public_metrics?.like_count),
      reposts: asNumberOrUndefined(post.public_metrics?.retweet_count),
    });
  }
  return raws;
}

/**
 * Build the recent-search query targeting the configured candidate accounts.
 * Candidates without a handle contribute nothing. Returns `null` when no
 * candidate has a usable handle, so the caller can skip the network entirely.
 */
function buildFromQuery(candidates: readonly Candidate[]): string | null {
  const handles = candidates
    .map((c) => (isNonEmptyString(c.handle) ? normalizeHandle(c.handle) : null))
    .filter((h): h is string => h !== null);
  if (handles.length === 0) return null;
  // `from:handle OR from:handle ...` — the standard v2 recent-search form.
  return handles.map((h) => `from:${h}`).join(" OR ");
}

/** ISO 8601 timestamp for the start of the recent window (Req 4.1). */
function recentWindowStart(nowMs: number): string {
  return new Date(nowMs - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Fetch recent public posts for the configured candidate accounts, map each to
 * a `Tweet`, and drop any whose author handle matches no candidate.
 *
 * Behaviour (all without ever throwing):
 *   - Requests up to the 50 most recent posts within the last 30 days per
 *     configured account (Req 4.1).
 *   - Wraps the request in a 10s `AbortController` timeout; exceeding it yields
 *     `{ kind: "failed" }` so the caller preserves the cache (Req 4.6).
 *   - HTTP 429 (or a documented rate-limit signal) yields
 *     `{ kind: "rateLimited" }` (Req 6.4, 6.5).
 *   - Any other non-success response, a network error, or an abort yields
 *     `{ kind: "failed" }` (Req 7.2, 7.3).
 *   - On success, the vendor body is adapted into `RawPost`s and run through
 *     {@link mapRawPosts}, which enforces public-only, fully-attributed,
 *     handle-matched filtering before the posts are returned.
 *
 * All fall-through paths log via `console.warn` and never include the bearer
 * token or any other credential value.
 *
 * Dependencies (`fetch`, timers) are injectable via {@link FetchLiveDeps} so a
 * test can drive the 10s timeout deterministically (task 4.2).
 */
export async function fetchLivePosts(
  candidates: readonly Candidate[],
  deps: FetchLiveDeps = {}
): Promise<FetchOutcome> {
  const token = process.env[BEARER_TOKEN_ENV];
  if (!isNonEmptyString(token)) {
    // Defensive: callers gate on isLivePostsEnabled(), but never attempt a
    // network call without credentials.
    // eslint-disable-next-line no-console
    console.warn("Live posts disabled (no bearer token); not attempting a live fetch.");
    return { kind: "failed" };
  }

  const fromQuery = buildFromQuery(candidates);
  if (fromQuery === null) {
    // No configured accounts to query; nothing to fetch.
    return { kind: "ok", posts: [] };
  }

  const fetchFn = deps.fetchFn ?? fetch;
  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
  const timeoutMs = deps.timeoutMs ?? FETCH_TIMEOUT_MS;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeoutFn(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set("query", fromQuery);
    url.searchParams.set("max_results", String(MAX_POSTS_PER_ACCOUNT));
    url.searchParams.set("start_time", recentWindowStart(Date.now()));
    url.searchParams.set("tweet.fields", "created_at,public_metrics,possibly_sensitive,author_id");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "name,username,protected");

    const res = await fetchFn(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (res.status === 429) {
      // eslint-disable-next-line no-console
      console.warn("Live posts rate-limited (HTTP 429); serving cache if available.");
      return { kind: "rateLimited" };
    }

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`Live posts fetch failed (HTTP ${res.status}); falling back.`);
      return { kind: "failed" };
    }

    const body = (await res.json()) as RawApiResponse;
    const raws = adaptRawResponse(body);
    const posts = mapRawPosts(raws, candidates);
    return { kind: "ok", posts };
  } catch (err) {
    if (timedOut) {
      // eslint-disable-next-line no-console
      console.warn(`Live posts fetch timed out after ${timeoutMs}ms; falling back.`);
    } else {
      // eslint-disable-next-line no-console
      console.warn("Live posts fetch errored; falling back.", err);
    }
    return { kind: "failed" };
  } finally {
    clearTimeoutFn(timer);
  }
}
