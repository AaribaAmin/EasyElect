import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Documentation test for the Live_Credentials and cache environment variables.
 *
 * Verifies that `server/.env.example` documents every required environment
 * variable by name with no real secret values (Requirement 5.5): the live
 * credential variable must be present with an empty value, and the cache
 * lifetime variable must be documented.
 *
 * Validates: Requirements 5.5
 */

const here = path.dirname(fileURLToPath(import.meta.url));
// Test lives in server/src/, so .env.example is one directory up.
const envExamplePath = path.resolve(here, "../.env.example");
const envExample = readFileSync(envExamplePath, "utf8");

/**
 * Collects the raw declared value for a `KEY=value` entry from a dotenv-style
 * file, ignoring commented (`# ...`) lines. Returns undefined when the key is
 * not declared as an assignment.
 */
function declaredValue(contents: string, key: string): string | undefined {
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() === key) {
      return line.slice(eq + 1).trim();
    }
  }
  return undefined;
}

describe(".env.example documents the live-posts credential and cache vars", () => {
  it("documents LIVE_POSTS_BEARER_TOKEN with an empty value (no secret)", () => {
    const value = declaredValue(envExample, "LIVE_POSTS_BEARER_TOKEN");
    // The variable must be present...
    expect(value).toBeDefined();
    // ...and left empty so no real secret is committed.
    expect(value).toBe("");
  });

  it("documents EASYELECT_POSTS_CACHE_TTL_SECONDS", () => {
    const value = declaredValue(envExample, "EASYELECT_POSTS_CACHE_TTL_SECONDS");
    expect(value).toBeDefined();
  });
});
