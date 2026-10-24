import type { Party } from "../../types/domain";
import styles from "./PartyBadge.module.css";

const PARTY_CLASS: Record<Party, string> = {
  Democratic: styles.dem,
  Republican: styles.rep,
  "Green-Rainbow": styles.green,
  Libertarian: styles.lib,
  Independent: styles.ind,
  Nonpartisan: styles.ind,
};

export default function PartyBadge({ party }: { party: Party }) {
  return <span className={`${styles.badge} ${PARTY_CLASS[party]}`}>{party}</span>;
}
