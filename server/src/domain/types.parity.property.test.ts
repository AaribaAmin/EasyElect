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
// The client runtime validator's PARTIES array lives under client/src/lib/.
const clientShapePath = path.resolve(
  here,
  "../../../client/src/lib/shape.ts",
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

/**
 * Party-union parity across the two domain type files and the client runtime
 * validator.
 *
 * The `Party` type is a string-literal union declared in both
 * server/src/domain/types.ts and client/src/types/domain.ts, and the member
 * set is mirrored a third time at runtime by the `PARTIES` array in
 * client/src/lib/shape.ts (which `validateCandidate` uses to accept a party).
 * If any of the three drifts, a valid server party could be rejected by the
 * client validator, or the two unions could diverge silently. This block pins
 * all three to the same member set.
 *
 * Validates: Requirements 7.1, 7.2, 7.4
 */

/**
 * Extracts the quoted string-literal members of an `export type <Name> = ...`
 * union. Reads from the `=` to the terminating `;`, then pulls every
 * single/double-quoted literal in declaration order. Returns undefined when
 * the union is not declared in the source.
 */
function extractUnionMembers(
  source: string,
  name: string,
): string[] | undefined {
  const header = new RegExp(`export\\s+type\\s+${name}\\s*=`);
  const match = header.exec(source);
  if (!match) return undefined;

  const start = match.index + match[0].length;
  const end = source.indexOf(";", start);
  const block = end === -1 ? source.slice(start) : source.slice(start, end);

  const members: string[] = [];
  const literal = /"([^"]*)"|'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = literal.exec(block)) !== null) {
    members.push(m[1] ?? m[2]);
  }
  return members;
}

/**
 * Extracts the quoted string-literal members of a
 * `const PARTIES: readonly Party[] = [ ... ]` array. Reads from the opening
 * `[` to the matching `]`, then pulls every quoted literal in order. Returns
 * undefined when the array is not declared in the source.
 */
function extractPartiesArray(source: string): string[] | undefined {
  const header = /PARTIES\s*:\s*readonly\s+Party\[\]\s*=\s*\[/;
  const match = header.exec(source);
  if (!match) return undefined;

  // Start the array scan at the opening `[` of the initializer — which is the
  // last character of the matched header — so the `[` inside `Party[]` in the
  // type annotation is not mistaken for the array opener.
  const openIndex = match.index + match[0].length - 1;
  const closeIndex = source.indexOf("]", openIndex + 1);
  if (openIndex === -1 || closeIndex === -1) return undefined;
  const block = source.slice(openIndex + 1, closeIndex);

  const members: string[] = [];
  const literal = /"([^"]*)"|'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = literal.exec(block)) !== null) {
    members.push(m[1] ?? m[2]);
  }
  return members;
}

const clientShapeSource = readFileSync(clientShapePath, "utf8");

describe("Party union parity across domain types and the client validator", () => {
  it("server and client Party unions have identical, equal-length member sets", () => {
    const serverMembers = extractUnionMembers(serverSource, "Party");
    const clientMembers = extractUnionMembers(clientSource, "Party");

    // Sanity: both unions parsed to a non-empty member list.
    expect(serverMembers).toBeDefined();
    expect(clientMembers).toBeDefined();
    expect(serverMembers!.length).toBeGreaterThan(0);

    // Equal length guards against a member present in only one file.
    expect(clientMembers!.length).toBe(serverMembers!.length);

    // Identical sets regardless of order.
    expect(new Set(clientMembers)).toEqual(new Set(serverMembers));

    // No duplicate members slipped into either union.
    expect(new Set(serverMembers).size).toBe(serverMembers!.length);
    expect(new Set(clientMembers).size).toBe(clientMembers!.length);
  });

  it("shape.ts PARTIES array equals the client Party union member set", () => {
    const clientMembers = extractUnionMembers(clientSource, "Party");
    const partiesArray = extractPartiesArray(clientShapeSource);

    expect(clientMembers).toBeDefined();
    expect(partiesArray).toBeDefined();
    expect(partiesArray!.length).toBeGreaterThan(0);

    // Equal length guards against the runtime validator drifting from the union.
    expect(partiesArray!.length).toBe(clientMembers!.length);
    expect(new Set(partiesArray)).toEqual(new Set(clientMembers));
    expect(new Set(partiesArray).size).toBe(partiesArray!.length);
  });
});
