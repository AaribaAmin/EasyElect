/**
 * Tracks which causes the user has adopted and their per-cause refinements.
 *
 * Causes are surfaced by the chatbot (it detects topics and calls addCause),
 * read by the Causes page (cards + refinements), and used by Connect to filter
 * entries. Persisted to localStorage since there's no login.
 */
import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useLocalStorage } from "../lib/storage";

/** Active causes: map of causeId -> selected refinement labels. */
export type ActiveCauses = Record<string, string[]>;

export interface CausesContextValue {
  activeCauses: ActiveCauses;
  activeIds: string[];
  hasCause: (id: string) => boolean;
  addCause: (id: string) => void;
  addCauses: (ids: string[]) => void;
  removeCause: (id: string) => void;
  toggleRefinement: (causeId: string, refinement: string) => void;
}

const CausesContext = createContext<CausesContextValue | null>(null);

export function CausesProvider({ children }: { children: ReactNode }) {
  const [activeCauses, setActiveCauses] = useLocalStorage<ActiveCauses>(
    "causes",
    {}
  );

  const addCause = useCallback(
    (id: string) => {
      setActiveCauses((prev) => (id in prev ? prev : { ...prev, [id]: [] }));
    },
    [setActiveCauses]
  );

  const addCauses = useCallback(
    (ids: string[]) => {
      setActiveCauses((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of ids) {
          if (!(id in next)) {
            next[id] = [];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [setActiveCauses]
  );

  const removeCause = useCallback(
    (id: string) => {
      setActiveCauses((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [setActiveCauses]
  );

  const toggleRefinement = useCallback(
    (causeId: string, refinement: string) => {
      setActiveCauses((prev) => {
        const current = prev[causeId] ?? [];
        const next = current.includes(refinement)
          ? current.filter((r) => r !== refinement)
          : [...current, refinement];
        return { ...prev, [causeId]: next };
      });
    },
    [setActiveCauses]
  );

  const value = useMemo<CausesContextValue>(
    () => ({
      activeCauses,
      activeIds: Object.keys(activeCauses),
      hasCause: (id: string) => id in activeCauses,
      addCause,
      addCauses,
      removeCause,
      toggleRefinement,
    }),
    [activeCauses, addCause, addCauses, removeCause, toggleRefinement]
  );

  return (
    <CausesContext.Provider value={value}>{children}</CausesContext.Provider>
  );
}

export function useCauses(): CausesContextValue {
  const ctx = useContext(CausesContext);
  if (!ctx) {
    throw new Error("useCauses must be used within a CausesProvider");
  }
  return ctx;
}
