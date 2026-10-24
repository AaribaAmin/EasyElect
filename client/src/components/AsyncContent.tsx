import { type ReactNode } from "react";
import type { ApiState } from "../lib/useApi";

/**
 * Renders loading / error / empty states around async data so pages don't
 * repeat the boilerplate.
 */
export default function AsyncContent<T>({
  state,
  children,
  empty,
}: {
  state: ApiState<T>;
  children: (data: T) => ReactNode;
  empty?: ReactNode;
}) {
  if (state.loading) {
    return (
      <p className="card" role="status">
        Loading…
      </p>
    );
  }
  if (state.error) {
    return (
      <p className="card" role="alert">
        Couldn't load this content: {state.error}
      </p>
    );
  }
  if (
    state.data == null ||
    (Array.isArray(state.data) && state.data.length === 0)
  ) {
    return <>{empty ?? <p className="card">Nothing to show yet.</p>}</>;
  }
  return <>{children(state.data)}</>;
}
