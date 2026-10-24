import { Router } from "express";
import { candidates } from "../domain/candidates.js";
import { issues } from "../domain/issues.js";
import { tweets } from "../domain/tweets.js";
import { causes } from "../domain/causes.js";
import { connectEntries } from "../domain/connect.js";
import { quizQuestions } from "../domain/quiz.js";
import { electionInfo } from "../domain/election.js";
import { scoreQuiz, type QuizAnswer } from "../domain/quizScoring.js";

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

dataRouter.get("/tweets", (_req, res) => {
  res.json(tweets);
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
