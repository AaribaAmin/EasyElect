import "@testing-library/jest-dom/vitest";

// Some Node/jsdom builds don't expose a working localStorage unless started
// with --localstorage-file. Provide a simple in-memory polyfill so the app's
// persistence (follows, theme, mode) behaves normally under test.
if (
  typeof window !== "undefined" &&
  (!window.localStorage || typeof window.localStorage.clear !== "function")
) {
  const store = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  };
  Object.defineProperty(window, "localStorage", {
    value: mock,
    configurable: true,
  });
}
