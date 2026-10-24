import { useState } from "react";
import { apiPost } from "../../lib/api";
import { useSettings } from "../../context/SettingsContext";
import Explainer from "../../components/Explainer";
import Icon from "../../components/icons/Icon";
import type { Tweet } from "../../types/domain";
import styles from "./Tweets.module.css";

interface ContextApiResponse {
  context: string;
  source: "ai" | "scripted";
}

/**
 * A single post. In the "Needs Context" tab a context block is shown beneath
 * the post. Curated context (from the dataset) renders immediately; if a post
 * has none, the user can request context on demand, which calls /api/context
 * (real AI when configured, scripted otherwise) with the current detail mode.
 */
export default function TweetCard({
  tweet,
  showContext,
  followed,
}: {
  tweet: Tweet;
  showContext?: boolean;
  followed?: boolean;
}) {
  const { mode } = useSettings();
  const [dynamicContext, setDynamicContext] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  async function fetchContext() {
    setLoadingContext(true);
    try {
      const res = await apiPost<ContextApiResponse>("/api/context", {
        text: tweet.text,
        mode,
      });
      setDynamicContext(res.context);
    } catch {
      setDynamicContext("Couldn't load context right now. Please try again.");
    } finally {
      setLoadingContext(false);
    }
  }

  return (
    <article className={styles.tweet}>
      <header className={styles.tweetHead}>
        <div className={styles.author}>
          <span className={styles.avatar} aria-hidden="true">
            {tweet.authorName.charAt(0)}
          </span>
          <div>
            <strong>{tweet.authorName}</strong>{" "}
            <span className={styles.handle}>{tweet.authorHandle}</span>
            {followed && (
              <span className="badge" style={{ marginLeft: 8 }}>
                Following
              </span>
            )}
            <div className={styles.date}>
              {new Date(tweet.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </header>

      {tweet.inReplyTo && (
        <p className={styles.replyTo}>Replying to {tweet.inReplyTo}</p>
      )}

      <p className={styles.tweetText}>{tweet.text}</p>

      <footer className={styles.tweetFoot}>
        <span>
          <Icon name="like" size="sm" decorative /> {tweet.likes.toLocaleString()}
        </span>
        <span>
          <Icon name="repost" size="sm" decorative />{" "}
          {tweet.reposts.toLocaleString()}
        </span>
        {tweet.sourceUrl && (
          <a href={tweet.sourceUrl} target="_blank" rel="noopener noreferrer">
            Source
          </a>
        )}
      </footer>

      {showContext && (
        <aside className={styles.context}>
          <span className={styles.contextLabel}>
            <Icon name="info" size="sm" decorative /> Added context
          </span>
          {tweet.context ? (
            <Explainer content={tweet.context} className={styles.contextBody} />
          ) : dynamicContext ? (
            <p className={styles.contextBody}>{dynamicContext}</p>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={fetchContext}
              disabled={loadingContext}
            >
              {loadingContext ? "Getting context…" : "Add context"}
            </button>
          )}
        </aside>
      )}
    </article>
  );
}
