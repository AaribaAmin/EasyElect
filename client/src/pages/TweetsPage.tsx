import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useValidatedApiData } from "../lib/useApi";
import { validateTweetsResponse, validateCandidateList } from "../lib/shape";
import {
  orderByFollowed,
  buildPartyIndex,
  partyOptions,
  applyFeedFilters,
  ALL_PARTIES,
} from "../lib/feedFilter";
import type { PartySelection } from "../lib/feedFilter";
import { useFollow } from "../context/FollowContext";
import PageHeader from "../components/PageHeader";
import PostsStatus from "../components/PostsStatus";
import AsyncContent from "../components/AsyncContent";
import TweetCard from "../features/tweets/TweetCard";
import type { Candidate, Party, TweetTab, TweetsResponse } from "../types/domain";
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
  // Candidates power the Party_Index and party options. A fetch/validation
  // failure here must not take down the tweets feed: we fall back to an empty
  // candidate list so the Party_Index is empty (every post Unresolved) and the
  // party <select> offers only "All parties" (Req 1.6). The /api/tweets
  // AsyncContent above remains the sole content gate for the feed.
  const candidatesState = useValidatedApiData<Candidate[]>(
    "/api/candidates",
    validateCandidateList
  );
  const { following, count } = useFollow();
  const [tab, setTab] = useState<TweetTab>("recent");
  const [selectedParty, setSelectedParty] = useState<PartySelection>(ALL_PARTIES);
  const [followingOnly, setFollowingOnly] = useState<boolean>(false);

  const followingSet = useMemo(() => new Set(following), [following]);

  const candidates = candidatesState.data ?? [];
  const partyIndex = useMemo(() => buildPartyIndex(candidates), [candidates]);
  const partyChoices: Party[] = useMemo(
    () => partyOptions(candidates),
    [candidates]
  );

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

      <div className={styles.toolbar}>
        <label className="visually-hidden" htmlFor="tweet-party-filter">
          Filter posts by party
        </label>
        <select
          id="tweet-party-filter"
          className={styles.select}
          value={selectedParty}
          onChange={(e) => setSelectedParty(e.target.value as PartySelection)}
        >
          <option value="all">All parties</option>
          {partyChoices.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className={styles.followingToggle}>
          <input
            type="checkbox"
            checked={followingOnly}
            onChange={(e) => setFollowingOnly(e.target.checked)}
          />
          Only candidates I follow
        </label>
      </div>

      {/* The generic follow-hint describes the default (following-off) feed.
          Suppress it while the following-only filter is on and the user
          follows no one, so it never contradicts the "you follow no one"
          empty state rendered below (Req 4.2, 6.3). */}
      {followingOnly && count === 0 ? null : count === 0 ? (
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
          const filtered = applyFeedFilters({
            posts: response.posts,
            tab,
            party: selectedParty,
            followingOnly,
            followedSet: followingSet,
            partyIndex,
          });
          const ordered = followingOnly
            ? filtered
            : orderByFollowed(filtered, followingSet);
          // Empty-state decision (design.md "Empty-state decision"). Exactly
          // one branch renders; an empty-state message is never shown
          // concurrently with any post (Req 6.2). None of these branches
          // resets tab/selectedParty/followingOnly — they persist as
          // independent state across renders (Req 4.4, 6.4).
          return (
            <>
              <PostsStatus source={response.source} />
              {followingOnly && followingSet.size === 0 ? (
                // 1. Following-only on but the user follows no one: a message
                // with a navigable link to the candidate directory
                // (Req 4.1, 4.2, 4.3, 6.3).
                <p className={`card ${styles.empty}`}>
                  You're not following anyone yet.{" "}
                  <Link to="/voting/candidates">
                    Browse candidates to follow →
                  </Link>
                </p>
              ) : followingOnly && ordered.length === 0 ? (
                // 2. Following-only on, the user follows someone, but none of
                // the followed candidates have posts here — a distinct message
                // from branch 1 (Req 4.5).
                <p className={`card ${styles.empty}`}>
                  The candidates you follow have no posts here.
                </p>
              ) : ordered.length === 0 ? (
                // 3. Party/tab filters matched nothing (following-off or
                // irrelevant): a no-match message plus an actionable hint
                // (Req 6.1).
                <p className={`card ${styles.empty}`}>
                  No posts match these filters. Try "All parties" or another
                  tab.
                </p>
              ) : (
                // 4. Feed.
                <div className={styles.feed}>
                  {ordered.map((t) => (
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
