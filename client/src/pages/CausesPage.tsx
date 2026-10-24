import { Link } from "react-router-dom";
import { useApiData } from "../lib/useApi";
import { useCauses } from "../context/CausesContext";
import PageHeader from "../components/PageHeader";
import AsyncContent from "../components/AsyncContent";
import Explainer from "../components/Explainer";
import type { Cause } from "../types/domain";
import styles from "../features/causes/Causes.module.css";

/**
 * Causes section. Cards appear for the causes the user has adopted (surfaced by
 * the Ask Easy Elect chatbot). Each card lets the user refine sub-topics and
 * jump to related issues or to Connect.
 */
export default function CausesPage() {
  const state = useApiData<Cause[]>("/api/causes");
  const { activeCauses, activeIds, removeCause, toggleRefinement } = useCauses();

  return (
    <div>
      <PageHeader
        icon="causes"
        title="Causes"
        subtitle="The things you care about. Tell Ask Easy Elect a topic — like “I care about housing” — and a card shows up here to refine."
      />

      <AsyncContent state={state}>
        {(allCauses) => {
          const active = allCauses.filter((c) => activeIds.includes(c.id));

          if (active.length === 0) {
            return (
              <div className={`card ${styles.emptyState}`}>
                <h3>No causes yet</h3>
                <p>
                  Open Ask Easy Elect at the bottom of the screen and tell it
                  what matters to you. For example: “I care about climate and
                  schools.” Cards will appear here.
                </p>
              </div>
            );
          }

          return (
            <div className={styles.grid}>
              {active.map((cause) => {
                const selected = activeCauses[cause.id] ?? [];
                return (
                  <section key={cause.id} className={styles.causeCard}>
                    <header className={styles.cardHead}>
                      <h3 className={styles.cardTitle}>
                        <span aria-hidden="true">{cause.icon}</span>{" "}
                        {cause.title}
                      </h3>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeCause(cause.id)}
                        aria-label={`Remove ${cause.title} from your causes`}
                      >
                        ✕
                      </button>
                    </header>

                    <Explainer content={cause.blurb} className={styles.blurb} />

                    <fieldset className={styles.refinements}>
                      <legend className={styles.refineLegend}>
                        Narrow it down
                      </legend>
                      {cause.refinements.map((r) => (
                        <label
                          key={r}
                          className={
                            selected.includes(r)
                              ? styles.refineActive
                              : styles.refine
                          }
                        >
                          <input
                            type="checkbox"
                            className="visually-hidden"
                            checked={selected.includes(r)}
                            onChange={() => toggleRefinement(cause.id, r)}
                          />
                          {r}
                        </label>
                      ))}
                    </fieldset>

                    <footer className={styles.cardFoot}>
                      {cause.relatedIssueIds.length > 0 && (
                        <Link to="/voting/issues" className={styles.footLink}>
                          Read the issue →
                        </Link>
                      )}
                      <Link to="/connect" className={styles.footLink}>
                        Ways to get involved →
                      </Link>
                    </footer>
                  </section>
                );
              })}
            </div>
          );
        }}
      </AsyncContent>
    </div>
  );
}
