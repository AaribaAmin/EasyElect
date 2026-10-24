/**
 * Domain types for Easy Elect's curated data.
 *
 * These describe the shape of everything the API serves. The client mirrors
 * these in client/src/types/domain.ts — keep the two in sync when changing a
 * shape. All human-facing explanatory copy uses the `Explain` dual-variant so
 * the UI can show simple (plain-language) or expert (standard political) text.
 */

/** Dual-variant copy: `simple` is layman's terms, `expert` is standard terms. */
export interface Explain {
  simple: string;
  expert: string;
}

export type Party =
  | "Democratic"
  | "Republican"
  | "Independent"
  | "Libertarian"
  | "Green-Rainbow"
  | "Nonpartisan"
  | "Socialism and Liberation"
  | "Unenrolled";

/** Where a record's information originated, for attribution. */
export interface SourceAttribution {
  /** Human-readable publisher/source name, non-empty. */
  name: string;
  /** HTTP/HTTPS, 1–2048 chars, resolvable. */
  url: string;
  /** Retrieval-or-last-reviewed date, ISO 8601 (YYYY-MM-DD). Req 10.1. */
  reviewedOn: string;
}

/** A single candidate's stance on one issue. */
export interface CandidateStance {
  issueId: string;
  /** Short label of the position, e.g. "Expand rent stabilization". */
  position: string;
  /** Longer explanation of the stance, in both detail levels. */
  detail: Explain;
  /** Where this specific position was proposed/stated. Req 2.1. */
  source?: SourceAttribution;
}

export interface Candidate {
  id: string;
  name: string;
  party: Party;
  /** Office being sought, e.g. "Governor" or "US Senate". */
  office: string;
  /** District or jurisdiction, e.g. "Massachusetts" or "MA-7". */
  district: string;
  /** Short tagline / campaign slogan. */
  tagline: string;
  bio: Explain;
  /** Issue stances keyed by issueId (see Issue.id). */
  stances: CandidateStance[];
  /** Optional website for attribution / further reading. */
  website?: string;
  /** Handle used to associate curated tweets, e.g. "@jane_for_ma". */
  handle?: string;
  /** Where this candidate record's information originated. Req 3.1. */
  source: SourceAttribution;
}

/** A policy area / issue with a plain-language explainer. */
export interface Issue {
  id: string;
  title: string;
  /** One-line summary shown in lists. */
  summary: string;
  /** Full explainer in both detail levels. */
  explainer: Explain;
  /** Icon (emoji) for lightweight visual identity. */
  icon: string;
}

export type TweetTab = "recent" | "notable" | "needsContext" | "interactions";

/** A curated, real post attributed to its author. */
export interface Tweet {
  id: string;
  /** Candidate id this post is attributed to (links to Candidate.id). */
  candidateId: string;
  authorName: string;
  authorHandle: string;
  text: string;
  /** ISO date string of the post. */
  date: string;
  /** Engagement counts for display. */
  likes: number;
  reposts: number;
  /** Which tabs this post appears in. */
  tabs: TweetTab[];
  /**
   * Added context for the "Needs Context" tab. Present when the post benefits
   * from clarification. Task 13 can also generate this dynamically.
   */
  context?: Explain;
  /** For the Interactions tab: who/what this post is replying to. */
  inReplyTo?: string;
  /** Link back to the original source for attribution. */
  sourceUrl?: string;
}

/** Origin of a served posts payload. */
export type PostsSource = "live" | "cache" | "fallback";

/** Envelope returned by GET /tweets: the posts plus where they came from. */
export interface TweetsResponse {
  posts: Tweet[];
  source: PostsSource;
}

/** A quiz question used by the find-your-match quiz (Task 8). */
export interface QuizQuestion {
  id: string;
  /** The issue this question maps to. */
  issueId: string;
  prompt: string;
  /** Answer options from one end of the spectrum to the other. */
  options: QuizOption[];
}

export interface QuizOption {
  id: string;
  label: string;
  /**
   * Stance value from -2..2 used to score alignment against a candidate's
   * position value on the same issue.
   */
  value: number;
}

/** A cause/interest area that users can adopt and refine (Tasks 11-12). */
export interface Cause {
  id: string;
  title: string;
  icon: string;
  /** Keywords the chatbot matches to surface this cause. */
  keywords: string[];
  blurb: Explain;
  /** Suggested refinements users can toggle to narrow the cause. */
  refinements: string[];
  /** Related issue ids, linking causes to the Voting section. */
  relatedIssueIds: string[];
}

export type ConnectKind = "group" | "event" | "project" | "petition";

/** A Connect entry (group, event, community project, petition). */
export interface ConnectEntry {
  id: string;
  kind: ConnectKind;
  title: string;
  /** Cause ids this entry relates to, used to filter by active causes. */
  causeIds: string[];
  location: string;
  /** ISO date for events; omitted for ongoing groups/projects. */
  date?: string;
  description: Explain;
  /** Call to action label, e.g. "Sign petition", "RSVP", "Join". */
  cta: string;
  url?: string;
}
