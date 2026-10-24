import { useFollow } from "../../context/FollowContext";
import styles from "./FollowButton.module.css";

/**
 * Follow/unfollow toggle for a candidate. Uses aria-pressed so the state is
 * clear to assistive tech. Stops link navigation when nested inside a card.
 */
export default function FollowButton({
  candidateId,
  size = "md",
}: {
  candidateId: string;
  size?: "sm" | "md";
}) {
  const { isFollowing, toggleFollow } = useFollow();
  const following = isFollowing(candidateId);

  return (
    <button
      type="button"
      className={`${following ? styles.following : styles.follow} ${
        size === "sm" ? styles.sm : ""
      }`}
      aria-pressed={following}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFollow(candidateId);
      }}
    >
      {following ? "✓ Following" : "+ Follow"}
    </button>
  );
}
