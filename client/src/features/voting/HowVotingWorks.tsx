import { useApiData } from "../../lib/useApi";
import AsyncContent from "../../components/AsyncContent";
import Explainer from "../../components/Explainer";
import type { ElectionInfo } from "../../types/domain";
import styles from "./Voting.module.css";

/** Plain-language walkthrough of how the MA State Primary works. */
export default function HowVotingWorks() {
  const state = useApiData<ElectionInfo>("/api/election");

  return (
    <AsyncContent state={state}>
      {(info) => (
        <div>
          <section className="card" style={{ marginBottom: "var(--space-5)" }}>
            <h2 style={{ marginTop: 0 }}>{info.title}</h2>
            <p className={styles.office}>
              Primary date:{" "}
              {new Date(info.date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <Explainer content={info.intro} />
          </section>

          <h3>Steps to vote</h3>
          <ol className={styles.steps} style={{ listStyle: "none", padding: 0 }}>
            {info.steps.map((step, i) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h4 className={styles.stepTitle}>{step.title}</h4>
                  <Explainer content={step.body} className={styles.empty} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </AsyncContent>
  );
}
