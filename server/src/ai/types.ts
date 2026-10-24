export type DetailMode = "simple" | "expert";

export interface ChatRequest {
  message: string;
  mode: DetailMode;
}

export interface ChatResponse {
  reply: string;
  /** Cause ids detected in the user's message (drives Causes cards). */
  detectedCauses: string[];
  /** Which path produced the reply, useful for the UI and tests. */
  source: "ai" | "scripted";
}

export interface ContextRequest {
  text: string;
  mode: DetailMode;
}

export interface ContextResponse {
  context: string;
  source: "ai" | "scripted";
}
