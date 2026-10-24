import { Link, useParams } from "react-router-dom";
import { useApiData, useValidatedApiData } from "../../lib/useApi";
import { validateCandidate } from "../../lib/shape";
import { isDisplayableSourceUrl } from "../../lib/url";
import AsyncContent from "../../components/AsyncContent";
import Explainer from "../../components/Explainer";
import PartyBadge from "./PartyBadge";
import FollowButton from "./FollowButton";
import type { Candidate, Issue } from "../../types/domain";
import styles from "./Voting.module.css";

/**
 * Full candidate profile: bio (mode-aware), party/office, and issue stances.
 * The follow button is added in Task 6.
 */
export default function CandidateDetail() {
  const { id } = useParams();
  const state = useValidatedApiData<Candidate>(
    `/api/candidates/${id}`,
    validateCandidate
  );
  const issuesState = useApiData<Issue[]>("/api/issues");

  const issuesById = new Map(
    (issuesState.data ?? []).map((i) => [i.id, i])
  );

  return (
    <div>
      <Link to="/voting/candidates" className={styles.backLink}>
        ← All candidates
      </Link>

      <AsyncContent state={state}>
        {(c) => (
          <div>
            <div className={styles.detailHeader}>
              <div>
                <h2 style={{ marginBottom: 4 }}>{c.name}</h2>
                <p className={styles.office} style={{ margin: 0 }}>
                  {c.office} · {c.district}
                </p>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                <PartyBadge party={c.party} />
                <FollowButton candidateId={c.id} />
              </div>
            </div>

            <p style={{ fontStyle: "italic", color: "var(--color-text-muted)" }}>
              “{c.tagline}”
            </p>

            <section aria-label="Biography" className="card" style={{ marginBottom: "var(--space-5)" }}>
              <h3>About</h3>
              <Explainer content={c.bio} />
              {c.website && (
                <p style={{ marginBottom: 0 }}>
                  <a href={c.website} target="_blank" rel="noopener noreferrer">
                    Campaign site →
                  </a>
                </p>
              )}
              <p className={styles.sourceAttribution}>
                {isDisplayableSourceUrl(c.source.url) ? (
                  <>
                    Source:{" "}
                    <a
                      href={c.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c.source.name}
                    </a>
                  </>
                ) : (
                  <span className={styles.sourceUnavailable}>
                    Source unavailable
                  </span>
                )}
              </p>
            </section>

            <section aria-label="Positions">
              <h3>Where {c.name.split(" ")[0]} stands</h3>
              {c.stances.map((s) => {
                const issue = issuesById.get(s.issueId);
                return (
                  <div key={s.issueId} className={styles.stance}>
                    <span className={styles.stanceIssue}>
                      <span aria-hidden="true">{issue?.icon ?? "•"}</span>
                      {issue?.title ?? s.issueId}
                    </span>
                    <p className={styles.stancePosition}>{s.position}</p>
                    <Explainer content={s.detail} />
                  </div>
                );
              })}
            </section>
          </div>
        )}
      </AsyncContent>
    </div>
  );
}
