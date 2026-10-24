import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

/**
 * Integration tests for POST /api/chat covering the "healthcare query adds
 * housing card" bug fix.
 *
 * These exercise the full Express app (routing + cause detection + scripted
 * reply) via supertest, following the pattern in app.test.ts. With no
 * OPENAI_API_KEY set the server returns deterministic scripted output
 * (source: "scripted"), so cause detection and reply content are stable.
 *
 * Validates: Requirements 2.1, 3.1, 3.3
 */
describe("POST /api/chat — cause detection after housing-keyword fix", () => {
  // Expected Behavior 2.1 — affordability-framed healthcare query detects only
  // Healthcare, never Housing, and the reply mentions Healthcare not Housing.
  it("'I want affordable healthcare' returns only healthcare and a reply mentioning Healthcare not Housing (2.1)", async () => {
    const res = await request(createApp())
      .post("/api/chat")
      .send({ message: "I want affordable healthcare" });

    expect(res.status).toBe(200);
    expect(res.body.detectedCauses).toEqual(["healthcare"]);
    expect(res.body.detectedCauses).not.toContain("housing");

    const reply = String(res.body.reply);
    expect(reply).toMatch(/healthcare/i);
    expect(reply).not.toMatch(/housing/i);
  });

  // Preservation 3.1 — a genuine housing message still detects Housing.
  it("'my rent is too high' returns detectedCauses including housing (3.1)", async () => {
    const res = await request(createApp())
      .post("/api/chat")
      .send({ message: "my rent is too high" });

    expect(res.status).toBe(200);
    expect(res.body.detectedCauses).toContain("housing");
  });

  // Preservation 3.3 — a mixed query detects both Housing (via genuine keyword
  // "rent") and Healthcare.
  it("'affordable rent and healthcare' returns detectedCauses including both housing and healthcare (3.3)", async () => {
    const res = await request(createApp())
      .post("/api/chat")
      .send({ message: "affordable rent and healthcare" });

    expect(res.status).toBe(200);
    expect(res.body.detectedCauses).toContain("housing");
    expect(res.body.detectedCauses).toContain("healthcare");
  });
});
