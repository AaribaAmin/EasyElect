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
  | "Nonpartisan";

export interface CandidateStance {
  issueId: string;
  position: string;
  detail: Explain;
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
