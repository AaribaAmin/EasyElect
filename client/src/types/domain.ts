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

/**
 * A curated, verified news item relevant to one or more candidates.
 *
 * Mirrors `News_Item` in server/src/domain/types.ts — keep the two in sync.
 * This replaces the x.com-`Tweet` shape for the (repurposed) News section: the
 * section serves real, publicly published articles instead of social posts, so
 * an item carries a headline, outlet, resolvable source URL, and publication
 * date, and may be tied to one or more candidates (any-of matching for the
 * party/follow filters and followed-first ordering).
 */
export interface News_Item {
  id: string;
  /** One or more candidate ids (no duplicates), each matching a Candidate.id. */
  candidateIds: string[];
  /** The article headline. */
  title: string;
  /** The publisher / source name, e.g. "Boston Globe". */
  outlet: string;
  /** Resolvable HTTP/HTTPS link to the article (Verified_Source). */
  url: string;
  /** Publication date, ISO 8601. */
  date: string;
  /** Which tabs this item appears in (one or more). */
  tabs: TweetTab[];
  /** Optional neutral clarification shown on the Needs Context tab. */
  context?: Explain;
}

/**
 * @deprecated x.com-post shape retained only so client consumers (TweetCard,
 * feedFilter, shape validators, and their tests) keep compiling until later
 * tasks (1.3, 2.1/2.2, 3.2) migrate them to `News_Item`. The News section is
 * served as `News_Item[]`; do not use this for new code.
 */
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
  posts: News_Item[];
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
