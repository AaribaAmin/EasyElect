/**
 * Client-side mirror of the server domain types (server/src/domain/types.ts).
 * Keep in sync with the backend when shapes change.
 */
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

export interface CandidateStance {
  issueId: string;
  position: string;
  detail: Explain;
  /** Where this specific position was proposed/stated. Req 2.1. */
  source?: SourceAttribution;
}

export interface Candidate {
  id: string;
  name: string;
  party: Party;
  office: string;
  district: string;
  tagline: string;
  bio: Explain;
  stances: CandidateStance[];
  website?: string;
  handle?: string;
  /** Where this candidate record's information originated. Req 3.1. */
  source: SourceAttribution;
}

export interface Issue {
  id: string;
  title: string;
  summary: string;
  explainer: Explain;
  icon: string;
}

export type TweetTab = "recent" | "notable" | "needsContext" | "interactions";

export interface Tweet {
  id: string;
  candidateId: string;
  authorName: string;
  authorHandle: string;
  text: string;
  date: string;
  likes: number;
  reposts: number;
  tabs: TweetTab[];
  context?: Explain;
  inReplyTo?: string;
  sourceUrl?: string;
}

/** Origin of a served posts payload. */
export type PostsSource = "live" | "cache" | "fallback";

/** Envelope returned by GET /tweets: the posts plus where they came from. */
export interface TweetsResponse {
  posts: Tweet[];
  source: PostsSource;
}

export interface QuizOption {
  id: string;
  label: string;
  value: number;
}

export interface QuizQuestion {
  id: string;
  issueId: string;
  prompt: string;
  options: QuizOption[];
}

export interface MatchResult {
  candidateId: string;
  score: number;
  sharedIssues: number;
}

export interface Cause {
  id: string;
  title: string;
  icon: string;
  keywords: string[];
  blurb: Explain;
  refinements: string[];
  relatedIssueIds: string[];
}

export type ConnectKind = "group" | "event" | "project" | "petition";

export interface ConnectEntry {
  id: string;
  kind: ConnectKind;
  title: string;
  causeIds: string[];
  location: string;
  date?: string;
  description: Explain;
  cta: string;
  url?: string;
}

export interface ElectionInfo {
  title: string;
  date: string;
  intro: Explain;
  steps: { title: string; body: Explain }[];
}
