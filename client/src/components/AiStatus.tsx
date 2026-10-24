import { useApiData } from "../lib/useApi";
import styles from "./ApiStatus.module.css";

interface AiStatusResponse {
  aiEnabled: boolean;
}

/**
 * Shows whether live AI is configured. When off, the app still works via
 * scripted responses — this just makes the mode visible for the demo.
 */
export default function AiStatus() {
  const { data } = useApiData<AiStatusResponse>("/api/ai/status");
  if (data == null) return null;

  return (
    <span
      className={`${styles.badge} ${data.aiEnabled ? styles.online : styles.checking}`}
      role="status"
    >
      <span className={styles.dot} aria-hidden="true" />
      {data.aiEnabled ? "Live AI on" : "Scripted mode"}
    </span>
  );
}
