import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CandidateDetail from "./CandidateDetail";
import { DETAIL_UNAVAILABLE } from "../../lib/explain";
import { SettingsProvider } from "../../context/SettingsContext";
import { FollowProvider } from "../../context/FollowContext";
import type { Candidate } from "../../types/domain";

/**
 * Component tests for task 7.2 of all-ballot-candidates-by-office.
 *
 * CandidateDetail reads :id from the route, fetches /api/candidates/:id
 * (validated) and /api/issues, and renders a Minimum_Viable_Record without
 * fabricating biography or stance content. These tests cover the empty-content
 * guards:
 *   - stance-less record shows the "positions not yet available" message (Req 5.6)
 *   - empty-bio record renders no biography text and no placeholder (Req 5.7)
 *   - empty-office record renders district only, no office label, no error (Req 4.4)
 */

/**
 * A Minimum_Viable_Record: real ballot identity/office data with every
 * narrative field left empty rather than invented.
 */
function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "sample-candidate",
    name: "Sample Candidate",
    party: "Democratic",
    office: "Senator in Congress",
    district: "Massachusetts",
    tagline: "",
    bio: { simple: "", expert: "" },
    stances: [],
    source: {
      name: "Massachusetts Secretary of the Commonwealth — Sample Ballot",
      url: "https://www.sec.state.ma.us/WhereDoIVoteMA/ShowBallot/ViewMyBallot/BallotOut/ST/154/0/1",
      reviewedOn: "2026-10-24",
    },
    ...overrides,
  };
}

/**
 * Stub global.fetch so GET /api/candidates/<id> returns `candidate` (200) and
 * GET /api/issues returns [] (mirrors HomePage.test.tsx). The useValidatedApiData
 * hook runs the candidate payload through validateCandidate, so the fixture must
 * be a well-shaped Candidate.
 */
function stubFetch(candidate: Candidate) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body: unknown = url.includes("/api/candidates/") ? candidate : [];
      return {
        ok: true,
        status: 200,
        json: async () => body,
      };
    }) as unknown as typeof fetch
  );
}

function renderDetail(candidate: Candidate) {
  return render(
    <MemoryRouter initialEntries={[`/voting/candidates/${candidate.id}`]}>
      <SettingsProvider>
        <FollowProvider>
          <Routes>
            <Route
              path="/voting/candidates/:id"
              element={<CandidateDetail />}
            />
          </Routes>
        </FollowProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CandidateDetail empty-content guards (Req 4.4, 5.6, 5.7)", () => {
  it("shows the 'positions not yet available' message for a stance-less record (Req 5.6)", async () => {
    stubFetch(makeCandidate({ stances: [] }));
    renderDetail(makeCandidate({ stances: [] }));

    // First assertion waits for the async validated candidate to load.
    expect(
      await screen.findByText(
        "Positions are not yet available for this candidate."
      )
    ).toBeInTheDocument();
  });

  it("renders no biography text and no placeholder for an empty-bio record (Req 5.7)", async () => {
    const candidate = makeCandidate({ bio: { simple: "", expert: "" } });
    stubFetch(candidate);
    renderDetail(candidate);

    // Wait for load: the candidate name header confirms the record rendered.
    expect(
      await screen.findByRole("heading", { name: candidate.name })
    ).toBeInTheDocument();

    // The biography section ("About") is present...
    const bioSection = screen.getByRole("region", { name: "Biography" });
    expect(
      within(bioSection).getByRole("heading", { name: "About" })
    ).toBeInTheDocument();

    // ...but no Explainer is rendered for empty bio, so its "Detail unavailable"
    // placeholder must NOT appear, and no element carries the unavailable marker.
    expect(screen.queryByText(DETAIL_UNAVAILABLE)).not.toBeInTheDocument();
    expect(
      bioSection.querySelector('[data-detail-unavailable="true"]')
    ).toBeNull();

    // The source-attribution line always renders regardless of bio emptiness.
    expect(
      within(bioSection).getByRole("link", { name: candidate.source.name })
    ).toBeInTheDocument();
  });

  it("renders district only with no office label for an empty-office record (Req 4.4)", async () => {
    const candidate = makeCandidate({
      office: "",
      district: "Massachusetts",
    });
    stubFetch(candidate);
    renderDetail(candidate);

    // Wait for load, then assert the office line shows only the district with
    // no leading " · " office separator (and rendering did not throw).
    const officeLine = await screen.findByText("Massachusetts");
    expect(officeLine).toBeInTheDocument();
    expect(officeLine.textContent).toBe("Massachusetts");
    expect(officeLine.textContent).not.toContain("·");
  });
});
