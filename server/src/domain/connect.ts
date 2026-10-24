import type { ConnectEntry } from "./types.js";

/**
 * Connect entries: groups, events, community projects, and petitions. Each is
 * tagged with causeIds so the Connect section (Task 12) can filter to the
 * user's active causes.
 *
 * IMPORTANT: Illustrative, fictional entries for the demo. Organizations,
 * events, and links are not real.
 */
export const connectEntries: ConnectEntry[] = [
  {
    id: "c1",
    kind: "group",
    title: "Greater Boston Housing Now",
    causeIds: ["housing"],
    location: "Boston, MA",
    description: {
      simple: "A group of neighbors pushing for more affordable homes.",
      expert:
        "A grassroots coalition advocating for zoning reform and affordable-housing production.",
    },
    cta: "Join the group",
    url: "https://example.org/groups/housing-now",
  },
  {
    id: "c2",
    kind: "event",
    title: "Climate Town Hall",
    causeIds: ["climate", "transit"],
    location: "Cambridge, MA",
    date: "2026-09-05",
    description: {
      simple: "A public meeting to talk about clean energy and transit.",
      expert:
        "A town hall covering emissions targets, offshore wind, and transit electrification.",
    },
    cta: "RSVP",
    url: "https://example.org/events/climate-town-hall",
  },
  {
    id: "c3",
    kind: "petition",
    title: "Fund Our Public Schools",
    causeIds: ["education"],
    location: "Statewide",
    description: {
      simple: "A petition asking the state to give schools more money.",
      expert:
        "A petition urging accelerated Student Opportunity Act funding for high-need districts.",
    },
    cta: "Sign petition",
    url: "https://example.org/petitions/fund-schools",
  },
  {
    id: "c4",
    kind: "project",
    title: "Neighborhood Health Navigators",
    causeIds: ["healthcare"],
    location: "Springfield, MA",
    description: {
      simple:
        "Volunteers who help neighbors find affordable healthcare and sign up for coverage.",
      expert:
        "A community project training volunteer navigators to assist with coverage enrollment and access.",
    },
    cta: "Volunteer",
    url: "https://example.org/projects/health-navigators",
  },
  {
    id: "c5",
    kind: "event",
    title: "Rally for Safe Communities",
    causeIds: ["guns"],
    location: "Worcester, MA",
    date: "2026-09-12",
    description: {
      simple: "A gathering to talk about community safety and gun policy.",
      expert:
        "A public rally addressing community-safety measures and firearms policy.",
    },
    cta: "Attend",
    url: "https://example.org/events/safe-communities",
  },
  {
    id: "c6",
    kind: "group",
    title: "Riders for a Better MBTA",
    causeIds: ["transit"],
    location: "Greater Boston",
    description: {
      simple: "Transit riders working to make the T more reliable.",
      expert:
        "A rider-advocacy group pressing for MBTA reliability and sustainable funding.",
    },
    cta: "Join the group",
    url: "https://example.org/groups/better-mbta",
  },
  {
    id: "c7",
    kind: "project",
    title: "Solar for All Co-op",
    causeIds: ["climate"],
    location: "Statewide",
    description: {
      simple: "A group helping neighborhoods go solar together to save money.",
      expert:
        "A community solar cooperative enabling shared rooftop and community-solar subscriptions.",
    },
    cta: "Get involved",
    url: "https://example.org/projects/solar-coop",
  },
  {
    id: "c8",
    kind: "petition",
    title: "Protect Renters Petition",
    causeIds: ["housing"],
    location: "Statewide",
    description: {
      simple: "A petition for stronger protections for people who rent.",
      expert:
        "A petition supporting eviction protections and rent-stabilization measures.",
    },
    cta: "Sign petition",
    url: "https://example.org/petitions/protect-renters",
  },
];
