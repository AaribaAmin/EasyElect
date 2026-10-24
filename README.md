# Easy Elect

Easy Elect makes politics, elections, candidates, and civic participation easy
to understand for everyone, especially beginners. This repository is an MVP
scoped to a demo of the **Massachusetts State Primary**.

The app lets you:

- **Voting** — browse candidate profiles, read plain-language issue explainers,
  take a find-your-match quiz, learn how voting works, and compare candidates
  side by side.
- **Tweets** — read posts across four tabs (Recent, Notable, Needs Context,
  Interactions), with added context where a post needs it. The feed floats the
  candidates you follow to the top.
- **Causes** — tell the always-present **Ask Easy Elect** chatbot what you care
  about (housing, education, guns, climate, healthcare, transit) and it builds
  cause cards you can refine.
- **Connect** — find local groups, events, community projects, and petitions
  tied to your causes.

Two global controls shape the whole experience:

- **Dark / light theme**
- **Simple / Expert detail mode** — switch between plain-language and standard
  political terminology.

Everything works with **no login**; your theme, detail mode, followed
candidates, and causes are saved in your browser.

> **Note on data:** The candidates, posts, and connect entries in this MVP are
> **illustrative and fictional**, created for the demo. They do not represent
> real people or organizations. This avoids falsely attributing statements to
> real candidates. Replace the curated data in `server/src/domain/` with
> properly sourced, attributed content before using this beyond a demo.

## Tech stack

- **Frontend:** React + TypeScript (Vite), React Router, CSS variables for
  theming.
- **Backend:** Node + Express (TypeScript). Serves the curated JSON data and
  proxies AI calls so the API key stays server-side.
- **AI:** Pluggable. Uses a real LLM when an API key is configured; otherwise
  falls back to deterministic scripted responses so demos always work.
- **Tests:** Vitest (both workspaces), Supertest (API), Testing Library (UI).

This is an npm **workspaces** monorepo:

```
EasyElect/
├─ client/   # React + Vite frontend
├─ server/   # Express API + curated data + AI proxy
└─ package.json  # workspace scripts (dev/build/test)
```

## Prerequisites

- Node.js 20.19+ or 22.12+ (developed on Node 26)
- npm 9+

## Getting started

```bash
# install all workspace dependencies
npm install

# run the API (port 4000) and the client dev server (port 5173) together
npm run dev
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the
Express API automatically.

## Available scripts (run from the repo root)

| Script               | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Runs server + client together for development       |
| `npm run build`      | Builds the server, then the client                  |
| `npm start`          | Serves the built app (API + static client) on :4000 |
| `npm test`           | Runs server and client test suites                  |
| `npm run test:server`| Server tests only                                   |
| `npm run test:client`| Client tests only                                   |

To run the production build end to end:

```bash
npm run build
npm start          # serves API + built client on http://localhost:4000
```

## Enabling live AI (optional)

The chatbot and the tweet "Add context" feature work out of the box using
scripted responses. To enable **live AI**, give the server an OpenAI API key:

```bash
# from the repo root, for the dev server
OPENAI_API_KEY=sk-... npm run dev
```

Or copy `server/.env.example` to `server/.env` and fill it in (the key is read
from the environment; it is **never** sent to the browser).

Optional environment variables (server):

| Variable            | Default       | Purpose                              |
| ------------------- | ------------- | ------------------------------------ |
| `OPENAI_API_KEY`    | _(unset)_     | Enables live AI when present         |
| `EASYELECT_AI_MODEL`| `gpt-4o-mini` | Which chat model to call             |
| `PORT`              | `4000`        | API port                             |

When a key is set, the home page shows **"Live AI on"**; otherwise it shows
**"Scripted mode"**. If an AI request fails, the server falls back to scripted
output so the app keeps working.

## API overview

All endpoints are under `/api`:

- `GET /api/health` — service health check
- `GET /api/candidates`, `GET /api/candidates/:id`
- `GET /api/issues`, `GET /api/tweets`, `GET /api/causes`, `GET /api/connect`
- `GET /api/election` — "how voting works" content
- `GET /api/quiz`, `POST /api/quiz/score` — quiz questions and scoring
- `POST /api/chat` — chatbot reply + detected causes (`{ message, mode }`)
- `POST /api/context` — added context for a post (`{ text, mode }`)
- `GET /api/ai/status` — whether live AI is configured

## Editing the curated data

All demo content lives in `server/src/domain/`:

- `candidates.ts`, `issues.ts`, `tweets.ts`, `causes.ts`, `connect.ts`
- `election.ts` (how voting works), `quiz.ts` + `quizScoring.ts` (quiz)

Each piece of explanatory copy carries a `simple` and an `expert` variant so the
UI can match the detail mode. The client mirrors these shapes in
`client/src/types/domain.ts` — keep the two in sync when changing a type.

## Accessibility

The app aims for keyboard and screen-reader friendliness: semantic landmarks, a
skip link, labeled controls, `aria-pressed`/`aria-selected` on toggles and tabs,
visible focus styles, and a `prefers-reduced-motion` guard. Full WCAG
conformance still requires manual testing with assistive technologies and an
expert review.
