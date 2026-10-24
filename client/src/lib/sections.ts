/**
 * The four top-level sections of Easy Elect. Shared by the home page cards and
 * the primary navigation so they never drift out of sync.
 */
export interface SectionMeta {
  id: string;
  path: string;
  title: string;
  tagline: string;
  description: string;
  icon: string; // emoji keeps the MVP dependency-light
}

export const SECTIONS: SectionMeta[] = [
  {
    id: "voting",
    path: "/voting",
    title: "Voting",
    tagline: "Know who's on your ballot",
    description:
      "Candidate profiles, plain-language issue explainers, a find-your-match quiz, how voting works, and side-by-side comparisons.",
    icon: "🗳️",
  },
  {
    id: "tweets",
    path: "/tweets",
    title: "Tweets",
    tagline: "Posts, with context",
    description:
      "Recent and notable posts from candidates you follow, plus added context where a post needs it.",
    icon: "💬",
  },
  {
    id: "causes",
    path: "/causes",
    title: "Causes",
    tagline: "What matters to you",
    description:
      "Tell Ask Easy Elect what you care about — housing, education, guns — and build a set of cause cards you can refine.",
    icon: "🎯",
  },
  {
    id: "connect",
    path: "/connect",
    title: "Connect",
    tagline: "Find your people",
    description:
      "Local groups, civic events, and community projects tied to your causes — petitions, events, and ways to get involved.",
    icon: "🤝",
  },
];
