import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

const app = createApp();

describe("AI chat/context routes", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it("reports AI disabled when no key is set", async () => {
    const res = await request(app).get("/api/ai/status");
    expect(res.body.aiEnabled).toBe(false);
  });

  it("falls back to a scripted reply with no key, and detects causes", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "I really care about housing and rent", mode: "simple" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("scripted");
    expect(res.body.detectedCauses).toContain("housing");
    expect(typeof res.body.reply).toBe("string");
    expect(res.body.reply.length).toBeGreaterThan(0);
  });

  it("rejects an empty chat message", async () => {
    const res = await request(app).post("/api/chat").send({ message: "  " });
    expect(res.status).toBe(400);
  });

  it("returns scripted context with no key", async () => {
    const res = await request(app)
      .post("/api/context")
      .send({ text: "Some debated political claim", mode: "expert" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("scripted");
    expect(res.body.context.length).toBeGreaterThan(0);
  });

  it("uses the AI path when a key is set (mocked provider)", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    // Mock the OpenAI HTTP call so no real network/secret is used.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "AI generated reply." } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const res = await request(app)
      .post("/api/chat")
      .send({ message: "tell me about climate", mode: "simple" });

    expect(res.body.source).toBe("ai");
    expect(res.body.reply).toBe("AI generated reply.");
    // The key must be sent in the server->provider call, never to the client.
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const init = call[1];
    expect((init.headers as Record<string, string>).Authorization).toContain(
      "test-key"
    );
    // And the client response must not leak the key.
    expect(JSON.stringify(res.body)).not.toContain("test-key");
  });

  it("falls back to scripted when the AI call fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch
    );

    const res = await request(app)
      .post("/api/chat")
      .send({ message: "hello", mode: "simple" });
    expect(res.body.source).toBe("scripted");
  });
});
