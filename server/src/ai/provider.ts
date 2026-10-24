import type { DetailMode } from "./types.js";

/**
 * Pluggable LLM provider.
 *
 * If OPENAI_API_KEY is set, calls the OpenAI Chat Completions REST API via the
 * built-in fetch (no SDK dependency). Otherwise returns null so callers fall
 * back to scripted responses. The API key is read from the environment and
 * never leaves the server.
 */
const MODEL = process.env.EASYELECT_AI_MODEL ?? "gpt-4o-mini";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export function isAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function systemPrompt(mode: DetailMode): string {
  const base =
    "You are Ask Easy Elect, a friendly, strictly nonpartisan assistant that helps beginners understand the Massachusetts State Primary: candidates, issues, and how to vote. Never tell someone who to vote for. Keep replies to a few sentences.";
  return mode === "simple"
    ? `${base} Explain everything in plain, simple language a newcomer can follow. Avoid jargon.`
    : `${base} Use precise, standard political terminology suitable for an informed reader.`;
}

/**
 * Ask the LLM for a chat reply. Returns the text, or null if AI is disabled or
 * the call fails (so the caller can fall back to scripted).
 */
export async function aiChat(
  message: string,
  mode: DetailMode
): Promise<string | null> {
  return callOpenAI(systemPrompt(mode), message);
}

/** Ask the LLM to add neutral context to a social post. */
export async function aiContext(
  text: string,
  mode: DetailMode
): Promise<string | null> {
  const system =
    mode === "simple"
      ? "You add brief, neutral, plain-language context to a political social media post so a beginner understands what it's about and what's debated. 2-3 sentences. Stay strictly nonpartisan."
      : "You add brief, neutral context to a political social media post, using standard terminology and noting the relevant policy debate. 2-3 sentences. Stay strictly nonpartisan.";
  return callOpenAI(system, `Post: "${text}"\n\nAdd context:`);
}

async function callOpenAI(
  system: string,
  user: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`AI request failed (${res.status}); falling back to scripted.`);
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("AI request errored; falling back to scripted.", err);
    return null;
  }
}
