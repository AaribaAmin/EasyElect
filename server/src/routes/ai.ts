import { Router } from "express";
import { aiChat, aiContext, isAiEnabled } from "../ai/provider.js";
import {
  detectCauses,
  scriptedReply,
  scriptedContext,
} from "../ai/scripted.js";
import type {
  ChatResponse,
  ContextResponse,
  DetailMode,
} from "../ai/types.js";

/**
 * Chat + context endpoints. Both try the real LLM first (if a key is set) and
 * fall back to deterministic scripted output otherwise, so the product works
 * with or without AI configured. Cause detection is always keyword-based and
 * deterministic so Causes behavior is predictable.
 */
export const aiRouter = Router();

function normalizeMode(value: unknown): DetailMode {
  return value === "expert" ? "expert" : "simple";
}

aiRouter.get("/ai/status", (_req, res) => {
  res.json({ aiEnabled: isAiEnabled() });
});

aiRouter.post("/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message : "";
  const mode = normalizeMode(req.body?.mode);

  if (!message.trim()) {
    res.status(400).json({ error: "Expected { message: string }" });
    return;
  }

  // Cause detection is deterministic regardless of AI, so Causes cards behave
  // consistently.
  const detectedCauses = detectCauses(message);

  const aiReply = await aiChat(message, mode);
  const response: ChatResponse = aiReply
    ? { reply: aiReply, detectedCauses, source: "ai" }
    : { reply: scriptedReply(message, mode), detectedCauses, source: "scripted" };

  res.json(response);
});

aiRouter.post("/context", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const mode = normalizeMode(req.body?.mode);

  if (!text.trim()) {
    res.status(400).json({ error: "Expected { text: string }" });
    return;
  }

  const aiCtx = await aiContext(text, mode);
  const response: ContextResponse = aiCtx
    ? { context: aiCtx, source: "ai" }
    : { context: scriptedContext(text, mode), source: "scripted" };

  res.json(response);
});
