import { causes } from "../domain/causes.js";
import { candidates } from "../domain/candidates.js";
import { electionInfo } from "../domain/election.js";
import type { DetailMode } from "./types.js";

/**
 * Scripted (no-LLM) responses. This is both the always-available fallback and
 * the source of deterministic behavior for tests. It never needs network or a
 * key, so demos always work.
 */

/** Detect which cause ids a message is about, by keyword matching. */
export function detectCauses(message: string): string[] {
  const text = message.toLowerCase();
  const hits: string[] = [];
  for (const cause of causes) {
    if (cause.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      hits.push(cause.id);
    }
  }
  return hits;
}

/** A canned but genuinely useful reply, tuned to the detail mode. */
export function scriptedReply(message: string, mode: DetailMode): string {
  const text = message.toLowerCase();
  const detected = detectCauses(message);

  // Greetings / help.
  if (/\b(hi|hello|hey|help|what can you do)\b/.test(text)) {
    return mode === "simple"
      ? "Hi! I can explain candidates and issues for the Massachusetts primary, help you figure out what you care about, and point you to ways to get involved. What's on your mind?"
      : "Hello. I can summarize candidate platforms, clarify policy areas, surface issues relevant to the MA State Primary, and connect your interests to civic actions. What would you like to explore?";
  }

  // How to vote.
  if (/\b(vote|voting|register|ballot|primary date|when)\b/.test(text)) {
    return mode === "simple"
      ? `The ${electionInfo.title} is on ${electionInfo.date}. Make sure you're registered, pick how you'll vote (mail, early, or in person), and choose a party's ballot. Check the Voting section's "How voting works" for the steps.`
      : `The ${electionInfo.title} is scheduled for ${electionInfo.date}. Massachusetts runs a semi-open primary; unenrolled voters may select any party ballot. See "How voting works" in the Voting section for registration deadlines and voting methods.`;
  }

  // Candidate mention.
  const named = candidates.find((c) =>
    text.includes(c.name.toLowerCase().split(" ")[0])
  );
  if (named) {
    return mode === "simple"
      ? `${named.name} is running for ${named.office}. Their focus: "${named.tagline}". Open their profile in the Voting section to see where they stand on the issues.`
      : `${named.name} (${named.party}) is a candidate for ${named.office}. Platform summary: "${named.tagline}". Their profile details issue-by-issue positions.`;
  }

  // Cause detected.
  if (detected.length > 0) {
    const titles = detected
      .map((id) => causes.find((c) => c.id === id)?.title)
      .filter(Boolean);
    return mode === "simple"
      ? `Sounds like you care about ${titles.join(
          " and "
        )}. I've added ${titles.length > 1 ? "cards" : "a card"} to your Causes page so you can refine what matters most and find ways to get involved.`
      : `Noted interest in ${titles.join(
          ", "
        )}. Corresponding cause card${
          titles.length > 1 ? "s have" : " has"
        } been surfaced in the Causes section, where you can refine sub-topics and view related civic actions.`;
  }

  // Fallback.
  return mode === "simple"
    ? "I can help with candidates, issues, how to vote, and causes you care about. Try telling me a topic, like \"I care about housing\" or \"tell me about Maura Healey\"."
    : "I can assist with candidate platforms, policy areas, voting procedure, and mapping your interests to causes. Try naming a policy area or a candidate.";
}

/** Scripted context for a tweet, used when no LLM is configured. */
export function scriptedContext(text: string, mode: DetailMode): string {
  return mode === "simple"
    ? `Here's some quick background on this post: it touches on a debated political topic. Consider checking the candidate's full position in the Voting section before forming a view. (Post: "${text.slice(0, 80)}…")`
    : `Editorial context: this statement engages a contested policy area. Readers should weigh it against the candidate's documented positions and independent analysis. (Excerpt: "${text.slice(0, 80)}…")`;
}
