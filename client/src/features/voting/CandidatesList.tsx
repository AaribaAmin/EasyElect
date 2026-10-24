import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApiData } from "../../lib/useApi";
import { useFollow } from "../../context/FollowContext";
import AsyncContent from "../../components/AsyncContent";
import PartyBadge from "./PartyBadge";
import FollowButton from "./FollowButton";
import type { Candidate, Party } from "../../types/domain";
import styles from "./Voting.module.css";

/**
 * Candidate directory with search (name/office/party) and a party filter.
 * Each card shows a follow toggle; followed candidates drive the Tweets feed.
 */
export default function CandidatesList() {
  const state = useApiData<Candidate[]>("/api/candidates");
  const { isFollowing } = useFollow();
  const [query, setQuery] = useState("");
  const [party, setParty] = useState<"all" | Party>("all");

  const parties = useMemo(() => {
    const set = new Set<Party>();
    (state.data ?? []).forEach((c) => set.add(c.party));
    return Array.from(set);
  }, [state.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state.data ?? []).filter((c) => {
      const matchesParty = party === "all" || c.party === party;
      const matchesQuery =
        q === "" ||
        c.name.toLowerCase().includes(q) ||
        c.office.toLowerCase().includes(q) ||
        c.party.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q);
      return matchesParty && matchesQuery;
    });
  }, [state.data, query, party]);

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
          filtered.length === 0 ? (
            <p className={`card ${styles.empty}`}>
              No candidates match your search.
            </p>
          ) : (
            <ul
              className={styles.grid}
              style={{ listStyle: "none", padding: 0, margin: 0 }}
            >
              {filtered.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/voting/candidates/${c.id}`}
                    className={styles.candidateCard}
                  >
                    <div className={styles.cardTopRow}>
                      <PartyBadge party={c.party} />
                      {isFollowing(c.id) && (
                        <span className="badge" aria-label="You follow this candidate">
                          Following
                        </span>
                      )}
                    </div>
                    <h3 className={styles.candidateName}>{c.name}</h3>
                    <p className={styles.office}>
                      {c.office} · {c.district}
                    </p>
                    <p className={styles.cardTagline}>{c.tagline}</p>
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <FollowButton candidateId={c.id} size="sm" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncContent>
    </div>
  );
}
