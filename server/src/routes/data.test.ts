import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { issuesById } from "../domain/issues.js";
import { candidatesById } from "../domain/candidates.js";
import { causesById } from "../domain/causes.js";

const app = createApp();

/** Asserts a value is a non-empty Explain {simple, expert}. */
function expectExplain(v: unknown) {
  expect(v).toBeTypeOf("object");
  const e = v as { simple?: unknown; expert?: unknown };
  expect(typeof e.simple).toBe("string");
  expect(typeof e.expert).toBe("string");
  expect((e.simple as string).length).toBeGreaterThan(0);
  expect((e.expert as string).length).toBeGreaterThan(0);
}

/**
 * Asserts a value has the dual-variant Explain {simple, expert} shape with
 * both fields present as strings, without requiring non-empty content.
 * Minimum_Viable_Records drawn from the official ballot legitimately carry
 * empty narrative fields (no fabricated content, Req 5.2/5.3), so the shape
 * must hold for every record but non-empty content only for researched ones.
 */
function expectExplainShape(v: unknown) {
  expect(v).toBeTypeOf("object");
  const e = v as { simple?: unknown; expert?: unknown };
  expect(typeof e.simple).toBe("string");
  expect(typeof e.expert).toBe("string");
}

describe("data endpoints", () => {
  it("serves candidates with dual-variant bios and valid issue refs", async () => {
    const res = await request(app).get("/api/candidates");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const c of res.body) {
      expect(c.id).toBeTypeOf("string");
      expect(c.name).toBeTypeOf("string");
      // Every record carries the dual-variant bio shape. Minimum_Viable_Records
      // legitimately leave the narrative empty (Req 5.2), so only the shape is
      // required here; non-empty dual-variant bios are asserted below for the
      // researched records.
      expectExplainShape(c.bio);
      for (const s of c.stances) {
        // Every stance references a real issue, and because a record only
        // carries stances when they are researched and sourced, their details
        // are genuine non-empty dual-variant content.
        expect(issuesById.has(s.issueId)).toBe(true);
        expectExplain(s.detail);
      }
    }

    // The researched records keep their non-empty dual-variant bios.
    const byId = new Map(
      (res.body as { id: string; bio: unknown }[]).map((c) => [c.id, c.bio])
    );
    for (const id of ["maura-healey", "mike-minogue"]) {
      expect(byId.has(id)).toBe(true);
      expectExplain(byId.get(id));
    }
  });

  it("returns 404 for an unknown candidate", async () => {
    const res = await request(app).get("/api/candidates/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("serves issues with explainers", async () => {
    const res = await request(app).get("/api/issues");
    expect(res.status).toBe(200);
    for (const i of res.body) expectExplain(i.explainer);
  });

  it("serves news items attributed to real candidates", async () => {
    const res = await request(app).get("/api/tweets");
    expect(res.status).toBe(200);
    // The endpoint returns a TweetsResponse envelope { posts, source } whose
    // posts are curated News_Items keyed to one or more candidateIds.
    expect(["live", "cache", "fallback"]).toContain(res.body.source);
    expect(Array.isArray(res.body.posts)).toBe(true);
    for (const t of res.body.posts) {
      // candidateIds is a non-empty, duplicate-free array whose every id
      // resolves to a real candidate (Verified_Source discipline).
      expect(Array.isArray(t.candidateIds)).toBe(true);
      expect(t.candidateIds.length).toBeGreaterThan(0);
      expect(new Set(t.candidateIds).size).toBe(t.candidateIds.length);
      for (const id of t.candidateIds) {
        expect(candidatesById.has(id)).toBe(true);
      }
      expect(Array.isArray(t.tabs)).toBe(true);
      if (t.context) expectExplain(t.context);
    }
    // When posts are present, at least one must carry context for the Needs
    // Context tab.
    if (res.body.posts.length > 0) {
      expect(
        res.body.posts.some((t: { context?: unknown }) => t.context)
      ).toBe(true);
    }
  });

  it("serves causes with keywords and related issues", async () => {
    const res = await request(app).get("/api/causes");
    expect(res.status).toBe(200);
    for (const c of res.body) {
      expect(c.keywords.length).toBeGreaterThan(0);
      expectExplain(c.blurb);
      for (const id of c.relatedIssueIds) expect(issuesById.has(id)).toBe(true);
    }
  });

  it("serves connect entries tagged with real causes", async () => {
    const res = await request(app).get("/api/connect");
    expect(res.status).toBe(200);
    for (const entry of res.body) {
      expectExplain(entry.description);
      for (const id of entry.causeIds) expect(causesById.has(id)).toBe(true);
    }
  });

  it("serves the election explainer and quiz", async () => {
    const election = await request(app).get("/api/election");
    expect(election.status).toBe(200);
    expectExplain(election.body.intro);

    const quiz = await request(app).get("/api/quiz");
    expect(quiz.status).toBe(200);
    for (const q of quiz.body) {
      expect(issuesById.has(q.issueId)).toBe(true);
      expect(q.options.length).toBeGreaterThan(0);
    }
  });
});
