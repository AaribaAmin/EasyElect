import { describe, it, expect, afterEach } from "vitest";
import { fetchLivePosts, type FetchLiveDeps } from "./provider.js";
import type { Candidate } from "../domain/types.js";

/**
 * Unit test for the 10s live-fetch timeout (task 4.2).
 *
 * `fetchLivePosts` wraps a single attempt in an `AbortController` that fires
 * after `timeoutMs` (10s in production, Req 4.6). When the budget is exceeded
 * the in-flight fetch is aborted and the outcome must be `{ kind: "failed" }`
 * so the caller preserves the existing cache rather than losing it.
 *
 * To drive this deterministically we inject:
 *   - a controllable timer (`setTimeoutFn`) that captures the scheduled abort
 *     handler instead of waiting on the real clock, so the test fires the
 *     timeout exactly when it chooses; and
 *   - a `fetchFn` that never resolves on its own and instead rejects only when
 *     the request's `AbortSignal` aborts — exactly how the built-in `fetch`
 *     behaves when its signal is aborted.
 *
 * No real time passes and no network is touched.
 *
 * Requirements: 4.6
 */

const BEARER_TOKEN_ENV = "LIVE_POSTS_BEARER_TOKEN";

/** A minimal, structurally valid candidate carrying a handle so the from-query is non-empty. */
function makeCandidate(id: string, handle: string): Candidate {
  return {
    id,
    name: `Candidate ${id}`,
    party: "Independent",
    office: "Governor",
    district: "Massachusetts",
    tagline: "A tagline",
    bio: { simple: "simple bio", expert: "expert bio" },
    stances: [],
    handle,
    source: {
      name: "Test Source",
      url: "https://example.com",
      reviewedOn: "2024-01-01",
    },
  };
}

/**
 * A `fetch` stub that models a slow request: it resolves only if/when its
 * `AbortSignal` aborts, rejecting with an `AbortError` — the same shape the
 * real `fetch` produces on abort. Absent an abort it never settles.
 */
const slowAbortableFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal ?? undefined;
    if (!signal) return; // never settles without a signal
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener(
      "abort",
      () => reject(abortError()),
      { once: true },
    );
  });

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

describe("fetchLivePosts: 10s timeout is treated as failed", () => {
  const originalToken = process.env[BEARER_TOKEN_ENV];

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env[BEARER_TOKEN_ENV];
    } else {
      process.env[BEARER_TOKEN_ENV] = originalToken;
    }
  });

  it("aborts the in-flight fetch when the timeout fires and yields { kind: 'failed' }", async () => {
    // A present bearer token so a live fetch is actually attempted.
    process.env[BEARER_TOKEN_ENV] = "test-bearer-token";

    const candidates = [makeCandidate("cand-1", "@jane_for_ma")];

    // Controllable timer: capture the scheduled abort handler and the budget
    // instead of relying on the real clock.
    let scheduledHandler: (() => void) | null = null;
    let scheduledMs: number | null = null;
    const fakeHandle = 1 as unknown as ReturnType<typeof setTimeout>;
    let cleared = false;

    const deps: FetchLiveDeps = {
      fetchFn: slowAbortableFetch,
      setTimeoutFn: (handler, ms) => {
        scheduledHandler = handler;
        scheduledMs = ms;
        return fakeHandle;
      },
      clearTimeoutFn: (handle) => {
        expect(handle).toBe(fakeHandle);
        cleared = true;
      },
    };

    const outcomePromise = fetchLivePosts(candidates, deps);

    // The provider scheduled a timeout for its 10s budget (Req 4.6).
    expect(scheduledMs).toBe(10_000);
    expect(scheduledHandler).toBeTypeOf("function");

    // Fire the timeout: this aborts the controller, which makes the slow fetch
    // reject with an AbortError and drives the outcome to "failed".
    scheduledHandler!();

    const outcome = await outcomePromise;
    expect(outcome).toEqual({ kind: "failed" });

    // The scheduled timer is always cleared in the finally block.
    expect(cleared).toBe(true);
  });
});
