/**
 * Global app settings: theme (dark/light) and detail mode (simple/expert).
 *
 * Both are persisted to localStorage and applied app-wide:
 *  - theme is reflected onto <html data-theme="..."> so CSS variables switch.
 *  - mode is consumed by the `pick()` helper and by components that render
 *    simple vs. expert copy, and is sent to the backend for AI requests.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useLocalStorage } from "../lib/storage";

export type Theme = "light" | "dark";
export type DetailMode = "simple" | "expert";

export interface SettingsContextValue {
  theme: Theme;
  mode: DetailMode;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  toggleMode: () => void;
  setMode: (m: DetailMode) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>(
    "theme",
    prefersDark() ? "dark" : "light"
  );
  const [mode, setMode] = useLocalStorage<DetailMode>("mode", "simple");

  // Reflect the theme onto the document so CSS variables apply everywhere.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      theme,
      mode,
      setTheme,
      setMode,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
      toggleMode: () => setMode(mode === "simple" ? "expert" : "simple"),
    }),
    [theme, mode, setTheme, setMode]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}

/**
 * Content shape carrying both detail levels. Variant selection for the current
 * Detail_Mode lives in `lib/explain.ts` (`selectVariant`), which reports
 * "detail unavailable" when the matching variant is missing (Req 8.1, 8.2).
 */
export interface Explain {
  simple: string;
  expert: string;
}
