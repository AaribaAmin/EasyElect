/**
 * useApiData — tiny data-fetching hook with loading/error state.
 *
 * Keeps components declarative without pulling in a data-fetching library for
 * the MVP. For the small, mostly-static dataset this is plenty.
 */
import { useEffect, useState } from "react";
import { apiGet } from "./api";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiData<T>(path: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    apiGet<T>(path)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}
