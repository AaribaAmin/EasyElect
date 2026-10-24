import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../../lib/api";
import { useApiData, useValidatedApiData } from "../../lib/useApi";
import { validateCandidateList } from "../../lib/shape";
import AsyncContent from "../../components/AsyncContent";
import PartyBadge from "./PartyBadge";
import FollowButton from "./FollowButton";
import type { Candidate, MatchResult, QuizQuestion } from "../../types/domain";
import styles from "./Quiz.module.css";

interface ScoreResponse {
  results: MatchResult[];
}

/**
 * Find-your-match quiz. Collects one answer per question, posts them to the
 * server for scoring, and shows ranked candidate matches with quick follow.
 */
export default function MatchQuiz() {
  const questionsState = useApiData<QuizQuestion[]>("/api/quiz");
  const candidatesState = useValidatedApiData<Candidate[]>(
    "/api/candidates",
    validateCandidateList
  );
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidatesById = new Map(
    (candidatesState.data ?? []).map((c) => [c.id, c])
  );

  async function submit(questions: QuizQuestion[]) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: questions
          .filter((q) => answers[q.id] !== undefined)
          .map((q) => ({ issueId: q.issueId, value: answers[q.id] })),
      };
      const res = await apiPost<ScoreResponse>("/api/quiz/score", payload);
      setResults(res.results.filter((r) => r.sharedIssues > 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not score the quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setAnswers({});
    setResults(null);
    setError(null);
  }

  return (
    <AsyncContent state={questionsState}>
      {(questions) => {
        const answeredCount = questions.filter(
          (q) => answers[q.id] !== undefined
        ).length;
        const allAnswered = answeredCount === questions.length;

        if (results) {
          return (
            <div>
              <h2>Your matches</h2>
              <p className={styles.sub}>
                Based on your answers, here's how the candidates line up.
              </p>
              <ol className={styles.results}>
                {results.map((r, i) => {
                  const c = candidatesById.get(r.candidateId);
                  if (!c) return null;
                  return (
                    <li key={r.candidateId} className={styles.resultRow}>
                      <div className={styles.rank}>{i + 1}</div>
                      <div className={styles.resultMain}>
                        <div className={styles.resultHead}>
                          <Link to={`/voting/candidates/${c.id}`}>
                            <strong>{c.name}</strong>
                          </Link>
                          <PartyBadge party={c.party} />
                        </div>
                        <p className={styles.office}>{c.office}</p>
                        <div
                          className={styles.meter}
                          role="meter"
                          aria-valuenow={r.score}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${r.score}% match`}
                        >
                          <span
                            className={styles.meterFill}
                            style={{ width: `${r.score}%` }}
                          />
                        </div>
                        <span className={styles.scoreLabel}>{r.score}% match</span>
                      </div>
                      <FollowButton candidateId={c.id} size="sm" />
                    </li>
                  );
                })}
              </ol>
              <button type="button" className="btn" onClick={reset}>
                Retake quiz
              </button>
            </div>
          );
        }

        return (
          <div>
            <p className={styles.sub}>
              Answer a few questions and we'll show which candidates line up with
              your views. Nothing is saved.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(questions);
              }}
            >
              {questions.map((q) => (
                <fieldset key={q.id} className={styles.question}>
                  <legend className={styles.legend}>{q.prompt}</legend>
                  <div className={styles.options}>
                    {q.options.map((opt) => (
                      <label
                        key={opt.id}
                        className={
                          answers[q.id] === opt.value
                            ? styles.optionActive
                            : styles.option
                        }
                      >
                        <input
                          type="radio"
                          name={q.id}
                          className="visually-hidden"
                          checked={answers[q.id] === opt.value}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))
                          }
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              {error && (
                <p className="card" role="alert">
                  {error}
                </p>
              )}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!allAnswered || submitting}
                >
                  {submitting ? "Scoring…" : "See my matches"}
                </button>
                <span className={styles.progress}>
                  {answeredCount} / {questions.length} answered
                </span>
              </div>
            </form>
          </div>
        );
      }}
    </AsyncContent>
  );
}
