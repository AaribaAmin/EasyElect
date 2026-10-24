import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { SECTIONS } from "../lib/sections";
import SettingsToggles from "./SettingsToggles";
import Chatbot from "./chatbot/Chatbot";
import Icon from "./icons/Icon";
import styles from "./Layout.module.css";

/**
 * App shell: a sticky header with brand, section nav, and the theme/mode
 * toggles; the routed page content; and the persistent Ask Easy Elect chatbot
 * anchored to the bottom of every page.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-root">
      <a href="#main" className={styles.skipLink}>
        Skip to main content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="Easy Elect home">
            <span className={styles.brandMark}>
              <Icon name="brand" decorative />
            </span>
            <span>
              Easy<strong>Elect</strong>
            </span>
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            {SECTIONS.map((s) => (
              <NavLink
                key={s.id}
                to={s.path}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {s.title}
              </NavLink>
            ))}
          </nav>

          <SettingsToggles />
        </div>
      </header>

      <main id="main" className="page">
        {children}
      </main>

      <Chatbot />
    </div>
  );
}
