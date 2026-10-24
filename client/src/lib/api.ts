/**
 * Thin fetch wrapper for the Easy Elect backend.
 *
 * All requests use same-origin relative "/api/..." paths; in development Vite
 * proxies these to the Express server (see vite.config.ts), and in production
 * the same server can serve the built client.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

export interface HealthResponse {
  status: string;
  service: string;
}
