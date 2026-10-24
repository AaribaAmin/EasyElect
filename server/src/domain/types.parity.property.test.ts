import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";

/**
 * Structural parity test for the shared domain shapes.
 *
 * Property 24: Client and server domain shapes are structurally equivalent.
 *
 * For every shape served by the Data_API, the set of field descriptors
 * (field name, TypeScript type text, required-vs-optional) must be identical
 * between the server source of truth (server/src/domain/types.ts) and its
 * client mirror (client/src/types/domain.ts). This guards against the two
 * files drifting apart when a shape changes.
 *
 * The test lives in the server workspace because that workspace can reach both
 * files: the server types sit next to this test, and the client file is read
 * via a repo-relative path. Both files are parsed with a small interface
 * parser, and the extracted descriptors are compared for each named shape.
 *
 * Validates: Requirements 9.1, 9.2
 */

const here = path.dirname(fileURLToPath(import.meta.url));
// This test lives in server/src/domain/, so the server types file is adjacent
// and the client mirror is three directories up, under client/src/types/.
const serverTypesPath = path.resolve(here, "./types.ts");
const clientTypesPath = path.resolve(
  here,
  "../../../client/src/types/domain.ts",
);

/** The shapes shared across the Data_API that must stay structurally equal. */
const SHARED_SHAPES = [
  "Candidate",
  "CandidateStance",
  "Tweet",
  "SourceAttribution",
  "TweetsResponse",
] as const;

/** A single interface field: its name, type text, and whether it is optional. */
interface FieldDescriptor {
  name: string;
  type: string;
  optional: boolean;
}

/**
 * Extracts the body text of an `export interface <Name> { ... }` block.
 * Returns undefined when the interface is not declared in the source.
 *
 * Brace matching is done by counting depth so nested object-literal field
 * types (e.g. `steps: { title: string }[]`) do not terminate the block early.
 */
function extractInterfaceBody(
  source: string,
  name: string,
): string | undefined {
  const header = new RegExp(`export\\s+interface\\s+${name}\\s*\\{`);
  const match = header.exec(source);
  if (!match) return undefined;

  const openIndex = source.indexOf("{", match.index);
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(openIndex + 1, i);
      }
    }
  }
  return undefined;
}

/**
 * Strips `//` line comments and `/* *\/` block comments from an interface body
 * so comment prose never leaks into a parsed field type. Kept intentionally
 * simple — the domain type files use plain comments, no strings with comment
 * markers inside field declarations.
 */
function stripComments(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

/**
 * Parses an interface body into a sorted list of field descriptors. Splits on
 * top-level `;` (depth-aware so object-literal field types stay intact), then
 * reads each `name?: type` entry.
 */
function parseFields(body: string): FieldDescriptor[] {
  const clean = stripComments(body);
  const fields: FieldDescriptor[] = [];

  let depth = 0;
  let current = "";
  const flush = () => {
    const entry = current.trim();
    current = "";
    if (entry.length === 0) return;
    const colon = entry.indexOf(":");
    if (colon === -1) return;
    let namePart = entry.slice(0, colon).trim();
    const type = entry.slice(colon + 1).trim().replace(/\s+/g, " ");
    const optional = namePart.endsWith("?");
    if (optional) namePart = namePart.slice(0, -1).trim();
    fields.push({ name: namePart, type, optional });
  };

  for (const ch of clean) {
    if (ch === "{" || ch === "(" || ch === "[" || ch === "<") depth++;
    else if (ch === "}" || ch === ")" || ch === "]" || ch === ">") depth--;
    if ((ch === ";" || ch === "\n") && depth === 0) {
      flush();
      continue;
    }
    current += ch;
  }
  flush();

  return fields.sort((a, b) => a.name.localeCompare(b.name));
}

function parseShape(source: string, name: string): FieldDescriptor[] {
  const body = extractInterfaceBody(source, name);
  if (body === undefined) {
    throw new Error(`interface ${name} not found in source`);
  }
  return parseFields(body);
}

const serverSource = readFileSync(serverTypesPath, "utf8");
const clientSource = readFileSync(clientTypesPath, "utf8");

describe("Property 24: client and server domain shapes are structurally equivalent", () => {
  // Deterministic per-shape comparison: each shared shape's descriptor set must
  // match exactly between the two files.
  for (const shape of SHARED_SHAPES) {
    it(`${shape} has identical field descriptors on both sides`, () => {
      const serverFields = parseShape(serverSource, shape);
      const clientFields = parseShape(clientSource, shape);

      // Sanity: the shape actually declares fields (guards a silent empty parse).
      expect(serverFields.length).toBeGreaterThan(0);
      expect(clientFields.length).toBeGreaterThan(0);

      expect(clientFields).toEqual(serverFields);
    });
  }

  // Property-based form over the shape list: for any shared shape, the server
  // and client descriptor sets are structurally equal (same field names, same
  // type text, same optionality). Driven by fast-check over SHARED_SHAPES.
  it("property: every shared shape is structurally equal across the two files", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SHARED_SHAPES), (shape) => {
        const serverFields = parseShape(serverSource, shape);
        const clientFields = parseShape(clientSource, shape);
        expect(clientFields).toEqual(serverFields);
      }),
      { numRuns: 100 },
    );
  });
});
