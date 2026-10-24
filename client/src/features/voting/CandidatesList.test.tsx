import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CandidatesList from "./CandidatesList";
import { FollowProvider } from "../../context/FollowContext";
import type { Candidate } from "../../types/domain";

/**
 * Component tests for task 6.3 of all-ballot-candidates-by-office.
 *
 * Covers grouped rendering by race (Req 3.3), party filtering of the visible
 * groups/candidates (Req 3.5), and the empty-state message when no candidate
 * matches the active filters (Req 3.7).
 */

const SOURCE = {
  name: "Ballot",
  url: "https://example.test",
  reviewedOn: "2026-10-24",
};

function candidate(overrides: Partial<Candidate>): Candidate {
  return {
    id: "x",
    name: "Name",
    party: "Democratic",
    office: "Governor",
    district: "Massachusetts",
    tagline: "",
    bio: { simple: "", expert: "" },
    stances: [],
    source: SOURCE,
    ...overrides,
  };
}

// Two races (Governor, Auditor) across two parties (Democratic, Republican).
const CANDIDATES: Candidate[] = [
  candidate({
    id: "a",
    name: "Alice Adams",
    party: "Democratic",
    office: "Governor",
    district: "Massachusetts",
  }),
  candidate({
    id: "b",
    name: "Bob Brown",
    party: "Republican",
    office: "Governor",
    district: "Massachusetts",
  }),
  candidate({
    id: "c",
    name: "Carol Chase",
    party: "Democratic",
    office: "Auditor",
    district: "Massachusetts",
  }),
];

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/voting/candidates"]}>
      <FollowProvider>
        <CandidatesList />
      </FollowProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  // CandidatesList fetches /api/candidates on mount via useValidatedApiData.
  // Serve the fixture for that endpoint and an empty/ok payload otherwise.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body: unknown = url.includes("/api/candidates") ? CANDIDATES : [];
      return {
        ok: true,
        status: 200,
        json: async () => body,
      };
    }) as unknown as typeof fetch
  );
  window.localStorage.clear();
});

describe("CandidatesList grouped rendering (Req 3.3)", () => {
  it("renders a heading per race group containing both office and district", async () => {
    renderList();

    // Wait for the fetched data to load and groups to render.
    const governorHeading = await screen.findByRole("heading", {
      name: /Governor.*Massachusetts/,
    });
    expect(governorHeading).toBeInTheDocument();

    const auditorHeading = screen.getByRole("heading", {
      name: /Auditor.*Massachusetts/,
    });
    expect(auditorHeading).toBeInTheDocument();

    // All three candidates are visible across the two groups.
    expect(screen.getByRole("heading", { name: "Alice Adams" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bob Brown" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Carol Chase" })).toBeInTheDocument();
  });
});

describe("CandidatesList party filter (Req 3.5)", () => {
  it("shows only groups/candidates matching the selected party", async () => {
    renderList();

    // Wait for data to load before interacting with the filter.
    await screen.findByRole("heading", { name: /Governor.*Massachusetts/ });

    const partyFilter = screen.getByLabelText("Filter by party");
    fireEvent.change(partyFilter, { target: { value: "Republican" } });

    // Only the Republican Governor candidate remains.
    expect(screen.getByRole("heading", { name: "Bob Brown" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Governor.*Massachusetts/ })
    ).toBeInTheDocument();

    // The Democratic-only candidates and the Auditor group are gone.
    expect(screen.queryByRole("heading", { name: "Alice Adams" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Carol Chase" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: /Auditor.*Massachusetts/ })
    ).toBeNull();
  });
});

describe("CandidatesList empty state (Req 3.7)", () => {
  it("renders the empty-state message and no race headings when nothing matches", async () => {
    renderList();

    // Wait for data to load before searching.
    await screen.findByRole("heading", { name: /Governor.*Massachusetts/ });

    const search = screen.getByLabelText("Search candidates");
    fireEvent.change(search, { target: { value: "zzzznomatch" } });

    expect(
      screen.getByText("No candidates match your search.")
    ).toBeInTheDocument();

    // No race-group headings render when the filters exclude every candidate.
    expect(
      screen.queryByRole("heading", { name: /Governor.*Massachusetts/ })
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: /Auditor.*Massachusetts/ })
    ).toBeNull();
  });
});
