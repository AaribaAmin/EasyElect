import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dataRouter } from "./routes/data.js";
import { aiRouter } from "./routes/ai.js";

/**
 * Builds the Express application.
 *
 * The app is created separately from the HTTP listener (see index.ts) so that
 * tests can import and exercise it with supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Liveness/health check used by the frontend to confirm the API is reachable.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "easyelect-server" });
  });

  // Curated data API (candidates, issues, tweets, causes, connect, quiz).
  app.use("/api", dataRouter);

  // AI-backed chat and tweet-context endpoints (with scripted fallback).
  app.use("/api", aiRouter);

  // In production, serve the built client (client/dist) and fall back to
  // index.html for client-side routes so a refresh on /voting/... still works.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
