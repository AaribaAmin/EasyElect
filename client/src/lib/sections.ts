import type { IconName } from "../components/icons/types";

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
  icon: IconName; // named glyph rendered by the Icon component
  color?: string; // per-card token name (e.g. "--card-voting"), never a color literal
}

export const SECTIONS: SectionMeta[] = [
  {
    id: "voting",
    path: "/voting",
    title: "Voting",
    tagline: "Know who's on your ballot",
    description:
      "View candidate profiles, take a find-your-match quiz, and learn how voting works.",
    icon: "voting",
    color: "--card-voting",
  },
  {
    id: "tweets",
    path: "/tweets",
    title: "Tweets",
    tagline: "Posts, with context",
    description:
      "See what politicians are saying and discover the bigger picture.",
    icon: "tweets",
    color: "--card-tweets",
  },
  {
    id: "causes",
    path: "/causes",
    title: "Causes",
    tagline: "What matters to you",
    description:
      "Tell Ask Easy Elect what you care about — housing, education, guns — and build a set of cause cards you can refine.",
    icon: "causes",
    color: "--card-causes",
  },
  {
    id: "connect",
    path: "/connect",
    title: "Connect",
    tagline: "Find your people",
    description:
      "Local groups, civic events, and community projects tied to your causes — petitions, events, and ways to get involved.",
    icon: "connect",
    color: "--card-connect",
  },
];
