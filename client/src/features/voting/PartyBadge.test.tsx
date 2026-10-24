import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PartyBadge from "./PartyBadge";
import type { Party } from "../../types/domain";

/**
 * Component tests for PartyBadge (Task 8.3).
 *
 * PartyBadge is a pure presentational component: it needs no router or
 * providers. These tests confirm that every member of the `Party` union — in
 * particular the two newly added members — renders a visible label (Req 6.5),
 * and that an out-of-union value renders a safe fallback badge without throwing
 * (Req 6.6).
 */

/** The full `Party` union, in the same order as `types/domain.ts`. */
const PARTY_MEMBERS: readonly Party[] = [
  "Democratic",
  "Republican",
  "Independent",
  "Libertarian",
  "Green-Rainbow",
  "Nonpartisan",
  "Socialism and Liberation",
  "Unenrolled",
];

describe("PartyBadge", () => {
  afterEach(cleanup);

  it("renders a visible label for every Party member, including the two new ones (Req 6.5)", () => {
    for (const member of PARTY_MEMBERS) {
      // Render each member in isolation so getByText is unambiguous.
      render(<PartyBadge party={member} />);
      const label = screen.getByText(member);
      expect(label).toBeInTheDocument();
      expect(label).toBeVisible();
      cleanup();
    }
  });

  it("renders the two new members specifically", () => {
    render(<PartyBadge party={"Socialism and Liberation"} />);
    expect(screen.getByText("Socialism and Liberation")).toBeVisible();
    cleanup();

    render(<PartyBadge party={"Unenrolled"} />);
    expect(screen.getByText("Unenrolled")).toBeVisible();
  });

  it("renders a fallback badge for an out-of-union value without throwing (Req 6.6)", () => {
    expect(() =>
      render(<PartyBadge party={"Totally Made Up Party" as Party} />)
    ).not.toThrow();
    // The label fallback uses the string itself when it is non-empty.
    expect(screen.getByText("Totally Made Up Party")).toBeVisible();
  });

  it("renders the 'Unknown' fallback for an empty-string value without throwing (Req 6.6)", () => {
    expect(() =>
      render(<PartyBadge party={"" as Party} />)
    ).not.toThrow();
    // An empty party string falls back to the literal "Unknown" label.
    expect(screen.getByText("Unknown")).toBeVisible();
  });
});
