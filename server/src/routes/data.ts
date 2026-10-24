import { Router } from "express";
import { candidates } from "../domain/candidates.js";
import { issues } from "../domain/issues.js";
import { tweets } from "../domain/tweets.js";
import { causes } from "../domain/causes.js";
import { connectEntries } from "../domain/connect.js";
import { quizQuestions } from "../domain/quiz.js";
import { electionInfo } from "../domain/election.js";
import { scoreQuiz, type QuizAnswer } from "../domain/quizScoring.js";
import type { TweetsResponse } from "../domain/types.js";
import { isLivePostsEnabled, fetchLivePosts } from "../posts/provider.js";
import {
  setCache,
  getCache,
  isCacheNonEmpty,
  isFresh,
  cacheLifetimeSeconds,
} from "../posts/cache.js";

/**
 * Read-only data API for the curated MA Primary dataset, plus the quiz scoring
 * endpoint. All responses are JSON.
 */
export const dataRouter = Router();

dataRouter.get("/candidates", (_req, res) => {
  res.json(candidates);
});

dataRouter.get("/candidates/:id", (req, res) => {
  const candidate = candidates.find((c) => c.id === req.params.id);
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  res.json(candidate);
});

dataRouter.get("/issues", (_req, res) => {
  res.json(issues);
});

/**
 * Serve the fallback dataset envelope. Used when live posting is disabled, or
 * when a live fetch fails with no usable cache (Req 7.1, 7.2).
 */
function fallbackResponse(): TweetsResponse {
  return { posts: tweets, source: "fallback" };
}

/** Serve the current cache as a success envelope (Req 6.2, 6.4, 7.3). */
function cacheResponse(): TweetsResponse {
  const current = getCache();
  return { posts: current ? current.posts : [], source: "cache" };
}

/**
 * Resolve the Tweets envelope via the cache → live → fallback decision tree
 * from the design's request-flow diagram.
 *
 * Returns either a {@link TweetsResponse} to send with HTTP 200, or an
 * `{ error }` object to send with HTTP 503 (the rate-limited-with-empty-cache
 * branch, Req 6.5).
 */
async function resolveTweets(): Promise<
  { ok: true; body: TweetsResponse } | { ok: false; error: string }
> {
  // Enabled check first (Req 5.4, 7.1): no credentials ⇒ serve fallback with
  // no network call.
  if (!isLivePostsEnabled()) {
    return { ok: true, body: fallbackResponse() };
  }

  // Freshness gate (Req 6.2, 10.3): a non-empty cache within lifetime is served
  // without any external call.
  const lifetime = cacheLifetimeSeconds();
  if (isCacheNonEmpty() && isFresh(lifetime)) {
    return { ok: true, body: cacheResponse() };
  }

  // Refresh trigger (Req 6.3, 10.2): cache stale or empty while enabled ⇒
  // attempt a fresh live fetch before responding.
  const outcome = await fetchLivePosts(candidates);

  switch (outcome.kind) {
    case "ok": {
      // Success ⇒ map/filter done in the provider; store with a UTC timestamp
      // and serve live (Req 6.1).
      setCache(outcome.posts);
      return { ok: true, body: { posts: outcome.posts, source: "live" } };
    }
    case "rateLimited": {
      // Rate-limited with a non-empty cache ⇒ serve cache as success (Req 6.4).
      if (isCacheNonEmpty()) {
        return { ok: true, body: cacheResponse() };
      }
      // Rate-limited with an empty cache ⇒ error, retain no partial records
      // (Req 6.5). The cache is left untouched.
      return { ok: false, error: "Live posts are temporarily unavailable" };
    }
    case "failed":
    default: {
      // Timeout / network / non-success ⇒ serve cache if present, else
      // fallback; the last-successful timestamp is left unchanged because a
      // failed attempt never calls setCache (Req 7.2, 7.3, 10.4).
      if (isCacheNonEmpty()) {
        return { ok: true, body: cacheResponse() };
      }
      return { ok: true, body: fallbackResponse() };
    }
  }
}

dataRouter.get("/tweets", async (_req, res) => {
  const result = await resolveTweets();
  if (!result.ok) {
    res.status(503).json({ error: result.error });
    return;
  }
  res.json(result.body);
});

/**
 * Report whether live posting is configured, mirroring GET /ai/status. Only the
 * boolean enabled flag is exposed — never the bearer token or any credential
 * value (Req 4.7, 5.4).
 */
dataRouter.get("/tweets/status", (_req, res) => {
  res.json({ livePostsEnabled: isLivePostsEnabled() });
});

dataRouter.get("/causes", (_req, res) => {
  res.json(causes);
});

dataRouter.get("/connect", (_req, res) => {
  res.json(connectEntries);
});

dataRouter.get("/election", (_req, res) => {
  res.json(electionInfo);
});

dataRouter.get("/quiz", (_req, res) => {
  res.json(quizQuestions);
});

/** Score submitted quiz answers against the candidate roster. */
dataRouter.post("/quiz/score", (req, res) => {
  const answers = req.body?.answers;
  if (!Array.isArray(answers)) {
    res.status(400).json({ error: "Expected { answers: QuizAnswer[] }" });
    return;
  }
  const clean: QuizAnswer[] = answers
    .filter(
      (a: unknown): a is QuizAnswer =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as QuizAnswer).issueId === "string" &&
        typeof (a as QuizAnswer).value === "number"
    )
    .map((a) => ({ issueId: a.issueId, value: a.value }));

  res.json({ results: scoreQuiz(clean) });
});
