import { describe, it, expect } from "vitest";
import { scoreQuiz, candidateIssueValues } from "./quizScoring.js";

describe("scoreQuiz", () => {
  it("ranks the most aligned candidate first", () => {
    // Answers matching Marcus Lindqvist's values exactly.
    const answers = [
      { issueId: "healthcare", value: 2 },
      { issueId: "climate", value: 2 },
      { issueId: "education", value: 2 },
      { issueId: "guns", value: 1 },
    ];
    const results = scoreQuiz(answers);
    expect(results[0].candidateId).toBe("marcus-lindqvist");
    expect(results[0].score).toBe(100);
  });

  it("ranks a progressive answer set toward progressive candidates", () => {
    const answers = [
      { issueId: "healthcare", value: -2 },
      { issueId: "climate", value: -2 },
      { issueId: "housing", value: -2 },
    ];
    const results = scoreQuiz(answers);
    // Sofia Alvarez matches all three exactly -> top and perfect score.
    expect(results[0].candidateId).toBe("sofia-alvarez");
    expect(results[0].score).toBe(100);
  });

  it("gives candidates with no shared issues a score of 0", () => {
    const answers = [{ issueId: "transit", value: 1 }];
    const results = scoreQuiz(answers);
    // Priya Nair has no transit value, so she shares no issues here.
    const priya = results.find((r) => r.candidateId === "priya-nair")!;
    expect(priya.sharedIssues).toBe(0);
    expect(priya.score).toBe(0);
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
    expect(Object.keys(candidateIssueValues)).toContain("harper-vega");
    expect(candidateIssueValues["harper-vega"].housing).toBe(1);
  });
});
