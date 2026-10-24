import { useApiData } from "../lib/useApi";
import type { PostsSource } from "../types/domain";
import styles from "./PostsStatus.module.css";

interface PostsStatusResponse {
  livePostsEnabled: boolean;
}

/**
 * External social API usage/attribution notice (Req 11.6). The external API's
 * terms require this disclosure to appear within every view that renders live
 * post content, so it is rendered here alongside the origin indicator and the
 * whole component is placed wherever posts are shown. Wording mirrors
 * DATA_SOURCES.md section 3.
 */
export const POSTS_USAGE_NOTICE =
  "Posts are retrieved from the external social API and are shown with " +
  "attribution to their original authors. Each post links back to the " +
  "original source. Easy Elect displays only publicly published content and " +
  "is not affiliated with or endorsed by the post authors or the social " +
  "platform.";

/** Human-readable label for each origin the posts envelope can report. */
const ORIGIN_LABEL: Record<PostsSource, string> = {
  live: "Live",
  cache: "Cached",
  fallback: "Fallback",
};

/**
 * Shows where the posts feed came from — "Live", "Cached", or "Fallback" — and
 * presents the required usage/attribution notice. The origin comes from the
 * `source` field of the posts envelope (`TweetsResponse.source`) that the
 * caller passes in; `GET /api/tweets/status` is read only to surface whether
 * live posting is configured at all, mirroring the AiStatus convention.
 */
export default function PostsStatus({ source }: { source: PostsSource }) {
  const { data } = useApiData<PostsStatusResponse>("/api/tweets/status");

  const originLabel = ORIGIN_LABEL[source];
  const label =
    data != null && !data.livePostsEnabled && source !== "live"
      ? `${originLabel} · live posting off`
      : originLabel;

  return (
    <div className={styles.container}>
      <span className={`${styles.badge} ${styles[source]}`} role="status">
        <span className={styles.dot} aria-hidden="true" />
        {label}
      </span>
      <p className={styles.notice}>{POSTS_USAGE_NOTICE}</p>
    </div>
  );
}
