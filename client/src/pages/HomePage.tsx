import { Link } from "react-router-dom";
import { SECTIONS } from "../lib/sections";
import ApiStatus from "../components/ApiStatus";
import AiStatus from "../components/AiStatus";
import styles from "./HomePage.module.css";

export default function HomePage() {
  return (
    <div>
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Politics, made <span>easy to understand</span>.
        </h1>
        <p className={styles.subtitle}>
          Easy Elect helps you make sense of the Massachusetts State Primary —
          who's running, what they stand for, and how to get involved. No jargon
          unless you want it.
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <ApiStatus />
          <AiStatus />
        </div>
      </section>

      <nav aria-label="Sections" className={styles.cards}>
        {SECTIONS.map((s) => (
          <Link key={s.id} to={s.path} className={styles.card}>
            <span className={styles.icon} aria-hidden="true">
              {s.icon}
            </span>
            <h2 className={styles.cardTitle}>{s.title}</h2>
            <p className={styles.tagline}>{s.tagline}</p>
            <p className={styles.description}>{s.description}</p>
            <span className={styles.cta}>Open {s.title} →</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
