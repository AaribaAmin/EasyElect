import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useValidatedApiData } from "../../lib/useApi";
import { validateCandidateList } from "../../lib/shape";
import { useFollow } from "../../context/FollowContext";
import AsyncContent from "../../components/AsyncContent";
import PartyBadge from "./PartyBadge";
import FollowButton from "./FollowButton";
import { groupCandidatesByRace } from "../../lib/raceGroups";
import type { Candidate, Party } from "../../types/domain";
import styles from "./Voting.module.css";

/**
 * Candidate directory with search (name/office/party) and a party filter.
 * Each card shows a follow toggle; followed candidates drive the Tweets feed.
 */
export default function CandidatesList() {
  const state = useValidatedApiData<Candidate[]>(
    "/api/candidates",
    validateCandidateList
  );
  const { isFollowing } = useFollow();
  const [query, setQuery] = useState("");
  const [party, setParty] = useState<"all" | Party>("all");

  const parties = useMemo(() => {
    const set = new Set<Party>();
    (state.data ?? []).forEach((c) => set.add(c.party));
    return Array.from(set);
  }, [state.data]);

  const groups = useMemo(
    () => groupCandidatesByRace(state.data ?? [], { query, party }),
    [state.data, query, party]
  );

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search by name, office, or party…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search candidates"
        />
        <label className="visually-hidden" htmlFor="party-filter">
          Filter by party
        </label>
        <select
          id="party-filter"
          className={styles.select}
          value={party}
          onChange={(e) => setParty(e.target.value as "all" | Party)}
        >
          <option value="all">All parties</option>
          {parties.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <AsyncContent state={state}>
        {() =>
          groups.length === 0 ? (
            <p className={`card ${styles.empty}`}>
              No candidates match your search.
            </p>
          ) : (
            groups.map((group) => (
              <section
                key={`${group.office}\u0000${group.district}`}
                className={styles.raceGroup}
              >
                <h2 className={styles.raceHeading}>
                  {group.office
                    ? `${group.office} · ${group.district}`
                    : group.district}
                </h2>
                <ul
                  className={styles.grid}
                  style={{ listStyle: "none", padding: 0, margin: 0 }}
                >
                  {group.candidates.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/voting/candidates/${c.id}`}
                        className={styles.candidateCard}
                      >
                        <div className={styles.cardTopRow}>
                          <PartyBadge party={c.party} />
                          {isFollowing(c.id) && (
                            <span
                              className="badge"
                              aria-label="You follow this candidate"
                            >
                              Following
                            </span>
                          )}
                        </div>
                        <h3 className={styles.candidateName}>{c.name}</h3>
                        <p className={styles.office}>
                          {c.office
                            ? `${c.office} · ${c.district}`
                            : c.district}
                        </p>
                        <p className={styles.cardTagline}>{c.tagline}</p>
                        <div style={{ marginTop: "var(--space-3)" }}>
                          <FollowButton candidateId={c.id} size="sm" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )
        }
      </AsyncContent>
    </div>
  );
}
