import { useSettings } from "../context/SettingsContext";
import styles from "./SettingsToggles.module.css";

/**
 * The two global controls: dark/light theme and simple/expert detail mode.
 * Both are plain buttons with aria-pressed so they're keyboard and screen
 * reader friendly.
 */
export default function SettingsToggles() {
  const { theme, mode, toggleTheme, toggleMode } = useSettings();

  return (
    <div className={styles.toggles}>
      <div
        className={styles.segmented}
        role="group"
        aria-label="Detail level"
        title="How much political detail to show"
      >
        <button
          type="button"
          className={mode === "simple" ? styles.segActive : styles.seg}
          aria-pressed={mode === "simple"}
          onClick={() => mode !== "simple" && toggleMode()}
        >
          Simple
        </button>
        <button
          type="button"
          className={mode === "expert" ? styles.segActive : styles.seg}
          aria-pressed={mode === "expert"}
          onClick={() => mode !== "expert" && toggleMode()}
        >
          Expert
        </button>
      </div>

      <button
        type="button"
        className={styles.themeBtn}
        onClick={toggleTheme}
        aria-pressed={theme === "dark"}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        <span aria-hidden="true">{theme === "dark" ? "🌙" : "☀️"}</span>
      </button>
    </div>
  );
}
