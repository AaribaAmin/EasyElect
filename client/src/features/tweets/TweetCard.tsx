import Explainer from "../../components/Explainer";
import Icon from "../../components/icons/Icon";
import type { News_Item } from "../../types/domain";
import styles from "./Tweets.module.css";

/**
 * A single curated news item. In the "Needs Context" tab a neutral context
 * block is shown beneath the item: curated context (from the dataset) renders
 * through the Explainer; if the item carries no context, a neutral "No added
 * context" message is shown instead.
 */
export default function TweetCard({
  tweet,
  showContext,
  followed,
}: {
  tweet: News_Item;
  showContext?: boolean;
  followed?: boolean;
}) {
  return (
    <article className={styles.tweet}>
      <header className={styles.tweetHead}>
        <div>
          <strong>{tweet.title}</strong>
          {followed && (
            <span className="badge" style={{ marginLeft: 8 }}>
              Following
            </span>
          )}
          <div className={styles.date}>
            <span className={styles.handle}>{tweet.outlet}</span>
            {" · "}
            {new Date(tweet.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      </header>

      <footer className={styles.tweetFoot}>
        <a href={tweet.url} target="_blank" rel="noopener noreferrer">
          Read article
        </a>
      </footer>

      {showContext && (
        <aside className={styles.context}>
          <span className={styles.contextLabel}>
            <Icon name="info" size="sm" decorative /> Added context
          </span>
          {tweet.context ? (
            <Explainer content={tweet.context} className={styles.contextBody} />
          ) : (
            <p className={styles.contextBody}>No added context.</p>
          )}
        </aside>
      )}
    </article>
  );
}
