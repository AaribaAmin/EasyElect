import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApiData } from "../lib/useApi";
import { useCauses } from "../context/CausesContext";
import PageHeader from "../components/PageHeader";
import AsyncContent from "../components/AsyncContent";
import Explainer from "../components/Explainer";
import type { Cause, ConnectEntry } from "../types/domain";
import styles from "../features/connect/Connect.module.css";

const KIND_LABEL: Record<ConnectEntry["kind"], string> = {
  group: "Group",
  event: "Event",
  project: "Project",
  petition: "Petition",
};

/**
 * Connect section. Shows groups, events, projects, and petitions filtered to
 * the user's active causes (from the Causes page). When the user has no causes,
 * everything is shown with a nudge to build causes via the chatbot.
 */
export default function ConnectPage() {
  const state = useApiData<ConnectEntry[]>("/api/connect");
  const causesState = useApiData<Cause[]>("/api/causes");
  const { activeIds } = useCauses();

  // Lets the user narrow further within their active causes.
  const [selected, setSelected] = useState<string[]>([]);
  const activeFilter = selected.length > 0 ? selected : activeIds;

  const causeTitle = useMemo(() => {
    const map = new Map((causesState.data ?? []).map((c) => [c.id, c.title]));
    return (id: string) => map.get(id) ?? id;
  }, [causesState.data]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div>
      <PageHeader
        icon="🤝"
        title="Connect"
        subtitle="Groups, events, projects, and petitions tied to the causes you care about. Find your people and get involved."
      />

      {activeIds.length > 0 && (
        <div className={styles.filterBar}>
          <span className={styles.filterLabel}>Filter by your causes:</span>
          {activeIds.map((id) => (
            <label
              key={id}
              className={selected.includes(id) ? styles.chipActive : styles.chip}
            >
              <input
                type="checkbox"
                className="visually-hidden"
                checked={selected.includes(id)}
                onChange={() => toggle(id)}
              />
              {causeTitle(id)}
            </label>
          ))}
        </div>
      )}

      <AsyncContent state={state}>
        {(entries) => {
          // When the user has causes, filter to entries matching them; else show all.
          const visible =
            activeFilter.length === 0
              ? entries
              : entries.filter((e) =>
                  e.causeIds.some((cid) => activeFilter.includes(cid))
                );

          if (activeIds.length === 0) {
            // No causes yet: show all but nudge toward building causes.
            return (
              <>
                <p className={`card ${styles.emptyState}`}>
                  <strong>Tip:</strong> Tell Ask Easy Elect what you care about
                  and this list will focus on groups and events for your causes.{" "}
                  <Link to="/causes">Build your causes →</Link>
                </p>
                <EntryGrid entries={visible} />
              </>
            );
          }

          if (visible.length === 0) {
            return (
              <div className={`card ${styles.emptyState}`}>
                <h3>Nothing matches yet</h3>
                <p>
                  There aren't any entries for the selected causes right now. Try
                  clearing the filter or adding more causes.
                </p>
              </div>
            );
          }

          return <EntryGrid entries={visible} />;
        }}
      </AsyncContent>
    </div>
  );
}

function EntryGrid({ entries }: { entries: ConnectEntry[] }) {
  return (
    <div className={styles.grid}>
      {entries.map((e) => (
        <article key={e.id} className={styles.entry}>
          <span className={styles.kind}>{KIND_LABEL[e.kind]}</span>
          <h3 className={styles.entryTitle}>{e.title}</h3>
          <p className={styles.meta}>
            {e.location}
            {e.date &&
              ` · ${new Date(e.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}`}
          </p>
          <Explainer content={e.description} className={styles.desc} />
          {e.url ? (
            <a
              className={`btn btn-primary ${styles.cta}`}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {e.cta}
            </a>
          ) : (
            <button type="button" className={`btn btn-primary ${styles.cta}`}>
              {e.cta}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
