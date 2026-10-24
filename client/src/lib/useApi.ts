/**
 * useApiData — tiny data-fetching hook with loading/error state.
 *
 * Keeps components declarative without pulling in a data-fetching library for
 * the MVP. For the small, mostly-static dataset this is plenty.
 */
import { useEffect, useState } from "react";
import { apiGet } from "./api";
import type { ShapeResult } from "./shape";

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

/**
 * useValidatedApiData — like `useApiData`, but runs the fetched payload through
 * a runtime shape validator before exposing it as data.
 *
 * A Data_API response is parsed JSON at runtime, so TypeScript cannot
 * guarantee it matches the declared client domain shape. When the payload is
 * missing a required field, renames a field, or carries a wrong-typed value,
 * the validator classifies it invalid; this hook then surfaces the resulting
 * type-mismatch error through the standard `error` state (so `AsyncContent`
 * renders it as an alert) and never exposes the mismatched payload as valid
 * `data` (Req 9.4).
 *
 * `validate` is one of the pure validators from `lib/shape.ts`; keeping the
 * validation logic there lets it be unit- and property-tested in isolation.
 */
export function useValidatedApiData<T>(
  path: string,
  validate: (value: unknown) => ShapeResult<T>
): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    apiGet<unknown>(path)
      .then((raw) => {
        if (cancelled) return;
        const result = validate(raw);
        if (result.valid) {
          setState({ data: result.value, loading: false, error: null });
        } else {
          setState({ data: null, loading: false, error: result.error });
        }
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
  }, [path, validate]);

  return state;
}
