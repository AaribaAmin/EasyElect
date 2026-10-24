import type { Party } from "../../types/domain";
import styles from "./PartyBadge.module.css";

const PARTY_CLASS: Record<Party, string> = {
  Democratic: styles.dem,
  Republican: styles.rep,
  "Green-Rainbow": styles.green,
  Libertarian: styles.lib,
  Independent: styles.ind,
  Nonpartisan: styles.ind,
  "Socialism and Liberation": styles.psl,
  Unenrolled: styles.ind,
};

export default function PartyBadge({ party }: { party: Party }) {
  const className = PARTY_CLASS[party] ?? styles.ind; // fallback for unknown (Req 6.6)
  const label = typeof party === "string" && party.length > 0 ? party : "Unknown";
  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}
