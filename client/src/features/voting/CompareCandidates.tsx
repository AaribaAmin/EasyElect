import { useMemo, useState } from "react";
import { useApiData } from "../../lib/useApi";
import { useSettings, pickVariant } from "../../context/SettingsContext";
import AsyncContent from "../../components/AsyncContent";
import PartyBadge from "./PartyBadge";
import type { Candidate, Issue } from "../../types/domain";
import styles from "./Compare.module.css";

/**
 * Side-by-side comparison: pick two or more candidates and see their stances
 * aligned row-by-row across every issue, respecting the simple/expert mode.
 */
export default function CompareCandidates() {
  const candidatesState = useApiData<Candidate[]>("/api/candidates");
  const issuesState = useApiData<Issue[]>("/api/issues");
  const { mode } = useSettings();
  const [selected, setSelected] = useState<string[]>([]);

  const candidates = candidatesState.data ?? [];
  const issues = issuesState.data ?? [];

  const chosen = useMemo(
    () => selected.map((id) => candidates.find((c) => c.id === id)!).filter(Boolean),
    [selected, candidates]
  );

  // Only show issue rows at least one chosen candidate has a stance on.
  const relevantIssues = useMemo(
    () =>
      issues.filter((issue) =>
        chosen.some((c) => c.stances.some((s) => s.issueId === issue.id))
      ),
    [issues, chosen]
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <AsyncContent state={candidatesState}>
      {() => (
        <div>
          <p>Pick two or more candidates to compare their positions.</p>
          <div className={styles.picker}>
            {candidates.map((c) => (
              <label
                key={c.id}
                className={
                  selected.includes(c.id) ? styles.chipActive : styles.chip
                }
              >
                <input
                  type="checkbox"
                  className="visually-hidden"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>

          {chosen.length < 2 ? (
            <p className={`card ${styles.hint}`}>
              Select at least two candidates above to see the comparison.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="visually-hidden">
                  Candidate position comparison by issue
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Issue</th>
                    {chosen.map((c) => (
                      <th scope="col" key={c.id}>
                        <div className={styles.colHead}>
                          <span>{c.name}</span>
                          <PartyBadge party={c.party} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relevantIssues.map((issue) => (
                    <tr key={issue.id}>
                      <th scope="row" className={styles.rowHead}>
                        <span aria-hidden="true">{issue.icon}</span>{" "}
                        {issue.title}
                      </th>
                      {chosen.map((c) => {
                        const stance = c.stances.find(
                          (s) => s.issueId === issue.id
                        );
                        return (
                          <td key={c.id}>
                            {stance ? (
                              <>
                                <strong className={styles.pos}>
                                  {stance.position}
                                </strong>
                                <span className={styles.detail}>
                                  {pickVariant(stance.detail, mode)}
                                </span>
                              </>
                            ) : (
                              <span className={styles.na}>No position listed</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AsyncContent>
  );
}
