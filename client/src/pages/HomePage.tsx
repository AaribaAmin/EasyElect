import { Link } from "react-router-dom";
import { SECTIONS } from "../lib/sections";
import Icon from "../components/icons/Icon";
import styles from "./HomePage.module.css";

export default function HomePage() {
  return (
    <div>
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Politics made <span className={styles.titleAccent}>easy</span>.
        </h1>
        <p className={styles.subtitle}>
          EasyElect helps you make sense of the Massachusetts State Primary —
          who's running, what they stand for, and how to get involved.
        </p>
      </section>

      <nav aria-label="Sections" className={styles.cards}>
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            to={s.path}
            className={styles.card}
            style={{
              background: s.color
                ? `var(${s.color}, var(--color-surface))`
                : "var(--color-surface)",
            }}
          >
            <span className={styles.icon} aria-hidden="true">
              <Icon name={s.icon} decorative />
            </span>
            <h2
              className={styles.cardTitle}
              style={{ textTransform: "uppercase", fontSize: "1.55rem" }}
            >
              {s.title}
            </h2>
            <p className={styles.tagline}>{s.tagline}</p>
            <p className={styles.description}>{s.description}</p>
            <span className={styles.cta}>Open {s.title} →</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
