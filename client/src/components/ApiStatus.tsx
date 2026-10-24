import { useEffect, useState } from "react";
import { apiGet, type HealthResponse } from "../lib/api";
import styles from "./ApiStatus.module.css";

type Status = "checking" | "online" | "offline";

/**
 * Small badge that confirms the backend is reachable by calling /api/health.
 * Primarily a Task 1 demo aid, but also a handy at-a-glance health indicator.
 */
export default function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    apiGet<HealthResponse>("/api/health")
      .then((res) => {
        if (!cancelled) setStatus(res.status === "ok" ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    status === "checking"
      ? "Checking service…"
      : status === "online"
      ? "Service online"
      : "Service offline";

  return (
    <span className={`${styles.badge} ${styles[status]}`} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
