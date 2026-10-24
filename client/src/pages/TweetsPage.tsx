import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useValidatedApiData } from "../lib/useApi";
import { validateTweetsResponse } from "../lib/shape";
import { filterByTab } from "../lib/tweetFilter";
import { useFollow } from "../context/FollowContext";
import PageHeader from "../components/PageHeader";
import PostsStatus from "../components/PostsStatus";
import AsyncContent from "../components/AsyncContent";
import TweetCard from "../features/tweets/TweetCard";
import type { Tweet, TweetTab, TweetsResponse } from "../types/domain";
import styles from "../features/tweets/Tweets.module.css";

const TABS: { id: TweetTab; label: string }[] = [
  { id: "recent", label: "Recent Posts" },
  { id: "notable", label: "Notable Posts" },
  { id: "needsContext", label: "Needs Context" },
  { id: "interactions", label: "Interactions" },
];

/**
 * Tweets section. Four tabs filter the curated posts; the "Needs Context" tab
 * shows an added-context block per post. The feed is tuned to followed
 * candidates — their posts float to the top — with a sensible default (all
 * posts) when the user follows no one.
 */
export default function TweetsPage() {
  const state = useValidatedApiData<TweetsResponse>(
    "/api/tweets",
    validateTweetsResponse
  );
  const { following, count } = useFollow();
  const [tab, setTab] = useState<TweetTab>("recent");

  const followingSet = useMemo(() => new Set(following), [following]);

  function orderByFollowed(list: Tweet[]): Tweet[] {
    if (count === 0) return list;
    // Stable sort: followed candidates first, original order preserved within.
    return [...list].sort((a, b) => {
      const af = followingSet.has(a.candidateId) ? 0 : 1;
      const bf = followingSet.has(b.candidateId) ? 0 : 1;
      return af - bf;
    });
  }

  return (
    <div>
      <PageHeader
        icon="tweets"
        title="Tweets"
        subtitle="Posts from the candidates, with added context where it helps. Follow candidates in Voting to tune your feed."
      />

      <div className={styles.tabs} role="tablist" aria-label="Tweet categories">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className={tab === t.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {count === 0 ? (
        <p className={styles.followHint}>
          You're not following anyone yet. Showing all posts.{" "}
          <Link to="/voting/candidates">Find candidates to follow →</Link>
        </p>
      ) : (
        <p className={styles.followHint}>
          Showing posts with the {count} candidate{count > 1 ? "s" : ""} you
          follow first.
        </p>
      )}

      <AsyncContent state={state}>
        {(response) => {
          const inTab = orderByFollowed(filterByTab(response.posts, tab));
          return (
            <>
              <PostsStatus source={response.source} />
              {inTab.length === 0 ? (
                <p className={`card ${styles.empty}`}>No posts in this tab yet.</p>
              ) : (
                <div className={styles.feed}>
                  {inTab.map((t) => (
                    <TweetCard
                      key={t.id}
                      tweet={t}
                      showContext={tab === "needsContext"}
                      followed={followingSet.has(t.candidateId)}
                    />
                  ))}
                </div>
              )}
            </>
          );
        }}
      </AsyncContent>
    </div>
  );
}
