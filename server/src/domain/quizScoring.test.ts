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
});
