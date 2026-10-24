import { useState } from "react";
import { useApiData, useValidatedApiData } from "../../lib/useApi";
import { validateCandidateList } from "../../lib/shape";
import AsyncContent from "../../components/AsyncContent";
import Explainer from "../../components/Explainer";
import PartyBadge from "./PartyBadge";
import type { Candidate, Issue } from "../../types/domain";
import styles from "./Voting.module.css";

/**
 * Per-issue explainers (mode-aware) with every candidate's stance on the
 * selected issue, so a beginner can read the issue and see who stands where.
 */
export default function IssuesExplorer() {
  const issuesState = useApiData<Issue[]>("/api/issues");
  const candidatesState = useValidatedApiData<Candidate[]>(
    "/api/candidates",
    validateCandidateList
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <AsyncContent state={issuesState}>
      {(issues) => {
        const selected =
          issues.find((i) => i.id === selectedId) ?? issues[0];
        const candidates = candidatesState.data ?? [];
        const withStance = candidates
          .map((c) => ({
            candidate: c,
            stance: c.stances.find((s) => s.issueId === selected.id),
          }))
          .filter((x) => x.stance);

        return (
          <div>
            <div className={styles.toolbar}>
              <label className="visually-hidden" htmlFor="issue-select">
                Choose an issue
              </label>
              <select
                id="issue-select"
                className={styles.select}
                value={selected.id}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {issues.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.icon} {i.title}
                  </option>
                ))}
              </select>
            </div>

            <section className="card" style={{ marginBottom: "var(--space-5)" }}>
              <h2 style={{ marginTop: 0 }}>
                <span aria-hidden="true">{selected.icon}</span> {selected.title}
              </h2>
              <Explainer content={selected.explainer} />
            </section>

            <h3>Where the candidates stand</h3>
            {withStance.length === 0 ? (
              <p className={`card ${styles.empty}`}>
                No candidate positions recorded for this issue yet.
              </p>
            ) : (
              withStance.map(({ candidate, stance }) => (
                <div key={candidate.id} className={styles.stance}>
                  <div className={styles.cardTopRow}>
                    <strong>{candidate.name}</strong>
                    <PartyBadge party={candidate.party} />
                  </div>
                  <p className={styles.stancePosition}>{stance!.position}</p>
                  <Explainer content={stance!.detail} />
                </div>
              ))
            )}
          </div>
        );
      }}
    </AsyncContent>
  );
}
