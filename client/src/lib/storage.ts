/**
 * Small typed wrapper around localStorage with a React hook.
 *
 * Easy Elect has no login, so all per-user state (theme, detail mode, follows,
 * causes) lives in the browser. This keeps that access in one place and fails
 * safe when storage is unavailable (e.g. private mode, SSR, tests).
 */
import { useCallback, useEffect, useState } from "react";

const PREFIX = "easyelect:";

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore write failures (quota, private mode) */
  }
}

/**
 * useLocalStorage — like useState, but persisted under the easyelect namespace.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStorage(key, initialValue));

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeStorage(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  // Keep multiple tabs/components roughly in sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === PREFIX + key && e.newValue != null) {
        try {
          setValue(JSON.parse(e.newValue) as T);
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [value, set];
}
