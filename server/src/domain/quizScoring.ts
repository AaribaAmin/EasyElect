import { candidates } from "./candidates.js";
import type { Candidate } from "./types.js";

/**
 * Each candidate's position on an issue, placed on the same -2..2 spectrum the
 * quiz options use (positive = more market/choice/deregulation-leaning,
 * negative = more public/regulation/safety-leaning). This mirrors the stances
 * in candidates.ts and is the ground truth the quiz scores against.
 *
 * maura-healey leans public/regulation/safety on every issue (negative):
 * state investment to build homes, advancing clean energy, investing Fair
 * Share revenue in transit and education, strengthening gun safety, and
 * lowering health care costs through caps and oversight.
 *
 * mike-minogue leans market/deregulation on every issue he has a sourced
 * stance on (positive): speeding permitting / easing building rules, repealing
 * the net-zero mandate, eliminating the gas tax, and lowering health care
 * costs through less state policy. He has no sourced guns stance, so guns is
 * omitted.
 */
export const candidateIssueValues: Record<string, Record<string, number>> = {
  "maura-healey": {
    housing: -2,
    climate: -2,
    transit: -1,
    education: -2,
    guns: -2,
    healthcare: -1,
  },
  "mike-minogue": {
    housing: 2,
    climate: 2,
    transit: 2,
    healthcare: 1,
  },
};

export interface QuizAnswer {
  issueId: string;
  value: number;
}

export interface MatchResult {
  candidateId: string;
  /** 0..100 alignment score; higher is a closer match. */
  score: number;
  /** Number of issues both the user and candidate had a position on. */
  sharedIssues: number;
}

/**
 * Scores the user's answers against every candidate.
 *
 * For each issue both the user and candidate have a value on, we measure the
 * distance on the -2..2 scale (max distance 4) and convert it to a 0..1
 * closeness. The candidate's score is the average closeness across shared
 * issues, scaled to 0..100. Candidates sharing no issues score 0.
 */
export function scoreQuiz(
  answers: QuizAnswer[],
  roster: Candidate[] = candidates
): MatchResult[] {
  const userByIssue = new Map(answers.map((a) => [a.issueId, a.value]));

  const results: MatchResult[] = roster.map((candidate) => {
    const issueValues = candidateIssueValues[candidate.id] ?? {};
    let total = 0;
    let shared = 0;

    for (const [issueId, candidateValue] of Object.entries(issueValues)) {
      if (!userByIssue.has(issueId)) continue;
      const userValue = userByIssue.get(issueId)!;
      const distance = Math.abs(userValue - candidateValue); // 0..4
      const closeness = 1 - distance / 4; // 1..0
      total += closeness;
      shared += 1;
    }

    const score = shared === 0 ? 0 : Math.round((total / shared) * 100);
    return { candidateId: candidate.id, score, sharedIssues: shared };
  });

  // Highest score first; break ties by more shared issues then id for stability.
  return results.sort(
    (a, b) =>
      b.score - a.score ||
      b.sharedIssues - a.sharedIssues ||
      a.candidateId.localeCompare(b.candidateId)
  );
}
