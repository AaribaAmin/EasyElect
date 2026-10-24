import { describe, it, expect } from "vitest";
import { scoreQuiz, candidateIssueValues } from "./quizScoring.js";

describe("scoreQuiz", () => {
  it("ranks the most aligned candidate first", () => {
    // Answers matching Mike Minogue's market/deregulation-leaning values.
    const answers = [
      { issueId: "housing", value: 2 },
      { issueId: "climate", value: 2 },
      { issueId: "transit", value: 2 },
      { issueId: "healthcare", value: 1 },
    ];
    const results = scoreQuiz(answers);
    expect(results[0].candidateId).toBe("mike-minogue");
    expect(results[0].score).toBe(100);
  });

  it("ranks a public/regulation answer set toward Maura Healey", () => {
    const answers = [
      { issueId: "healthcare", value: -1 },
      { issueId: "climate", value: -2 },
      { issueId: "housing", value: -2 },
    ];
    const results = scoreQuiz(answers);
    // Maura Healey matches all three exactly -> top and perfect score.
    expect(results[0].candidateId).toBe("maura-healey");
    expect(results[0].score).toBe(100);
  });

  it("gives candidates with no shared issues a score of 0", () => {
    const answers = [{ issueId: "guns", value: 1 }];
    const results = scoreQuiz(answers);
    // Mike Minogue has no guns value, so he shares no issues here.
    const minogue = results.find((r) => r.candidateId === "mike-minogue")!;
    expect(minogue.sharedIssues).toBe(0);
    expect(minogue.score).toBe(0);
  });

  it("produces scores within 0..100 for arbitrary answers", () => {
    const answers = [
      { issueId: "housing", value: 0 },
      { issueId: "climate", value: -1 },
      { issueId: "guns", value: 2 },
    ];
    for (const r of scoreQuiz(answers)) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("keeps candidate value maps consistent with known ids", () => {
    expect(Object.keys(candidateIssueValues)).toContain("maura-healey");
    expect(candidateIssueValues["maura-healey"].housing).toBe(-2);
  });

  // Regression (Req 5 side effect): growing the dataset to the full 26-candidate
  // ballot introduced 24 stance-less Minimum_Viable_Records. Those records have
  // no entry in candidateIssueValues, so they must score 0 and rank behind the
  // researched candidates (Healey, Minogue) — which keep their scores/ranking.
  it("keeps researched candidates ranked ahead of stance-less ballot records", () => {
    // Reuse the existing Minogue-leaning answer set.
    const answers = [
      { issueId: "housing", value: 2 },
      { issueId: "climate", value: 2 },
      { issueId: "transit", value: 2 },
      { issueId: "healthcare", value: 1 },
    ];
    const results = scoreQuiz(answers);

    // The researched candidate still ranks first with a perfect score even
    // after the dataset grew to the full ballot.
    expect(results[0].candidateId).toBe("mike-minogue");
    expect(results[0].score).toBe(100);

    // Every candidate id drives exactly one result and the whole 26-candidate
    // ballot is covered.
    expect(results).toHaveLength(26);

    const researchedIds = new Set(Object.keys(candidateIssueValues));
    const lastResearchedRank = Math.max(
      ...results
        .map((r, i) => ({ r, i }))
        .filter((x) => researchedIds.has(x.r.candidateId))
        .map((x) => x.i)
    );

    results.forEach((result, index) => {
      if (researchedIds.has(result.candidateId)) return;
      // Stance-less records (not healey/minogue) score 0 ...
      expect(result.score).toBe(0);
      // ... and sort after every researched candidate.
      expect(index).toBeGreaterThan(lastResearchedRank);
    });
  });
});
