# AI Launch Vehicle / Rideshare Selector

An AI-powered mission-planning tool for the IBM Builders Challenge (Space Exploration track). Type a free-text satellite mission description and the pipeline parses your requirements, filters a curated launch-vehicle catalog, ranks options by your weighted priorities, and explains the trade-offs — all in one page.

---

## IBM AI Builders Challenge — August 2025

### Problem statement

Small satellite and CubeSat missions typically begin with a frustrating, time-consuming manual survey of launch providers. A payload owner must cross-reference dozens of payload user's guides, rate cards, and schedule announcements to answer a deceptively simple question: *"Which rocket can actually carry my satellite to the right orbit, on budget, in time?"* The information is scattered, technical, and changes frequently — making the early architecture-trade phase unnecessarily slow and error-prone, even for experienced mission designers.

### Solution description

The AI Launch Vehicle / Rideshare Selector is a single-page web application that collapses that multi-day research exercise into seconds. A user describes their mission in plain English; the tool parses the requirements into structured fields, filters a curated catalog of real launch vehicles and rideshare programmes, ranks the remaining options against the user's weighted priorities (cost, schedule, orbit precision), and returns a plain-language explanation of why the top pick wins and what the trade-offs are against the alternatives. An "Improve my description" panel identifies missing fields before submission, and a post-parse nudge surfaces gaps inline after submission — both paths push the user toward a better-specified mission without interrupting the workflow.

### AI approach and architecture

The pipeline uses **Gemini 2.0 Flash** (via the Google Generative AI API) for three distinct tasks:

1. **Natural-language parsing** (`/api/parse`) — a structured-output prompt extracts six mission fields (payload mass, orbit type, target altitude, budget ceiling, max lead time, inclination flexibility) from a free-text description. Confidence is reported per-field so the UI can surface ambiguities.
2. **Trade-off explanation** (`/api/explain`) — given the ranked results, Gemini writes a concise, mission-specific rationale covering why the top vehicle was selected and how the alternatives compare.
3. **Description improvement** (`/api/improve`) — Gemini identifies which fields are missing and returns a rewritten draft with bracketed prompts for each gap, helping users self-correct before re-submitting.

All three AI steps degrade gracefully: if no `GEMINI_API_KEY` is present, the parser falls back to a regex heuristic, the explainer uses a template, and the improver returns a plain list of missing fields. The filter and ranking steps are fully deterministic and never require an LLM.

### Selected challenge theme

**Space Exploration** — the tool targets the early mission-design phase of a small satellite programme, helping payload owners make faster, better-informed launch-vehicle decisions before committing to a provider or procurement process.

### How IBM Bob was used

IBM Bob (the AI coding assistant embedded in the development environment) was used throughout the build:

- **Architecture and scoping** — Bob helped translate the challenge brief into a concrete feature list and a day-by-day build plan, and proposed the parse → filter → rank → explain pipeline structure.
- **Code generation** — Bob generated initial implementations of the Gemini prompt wrappers (`parser.ts`, `explainer.ts`, `improver.ts`), the catalog filter (`filter.ts`), and the weighted ranker (`ranker.ts`), as well as the Next.js API route handlers.
- **Test suite** — Bob wrote the Jest test suite (73 tests across five modules), including edge-case coverage for the regex fallback parser and the hard-constraint filter.
- **UI iteration** — Bob implemented the `ImprovePanel`, `SessionHistoryPanel`, `DownloadMenu`, and the post-parse confidence nudge, and iterated on layout and accessibility based on feedback.
- **Documentation** — Bob authored both `README.md` and `REPO_README.md`, and maintained the `launch-vehicle-configurator-plan.md` build log throughout the project.

---

## Features

- **Natural-language parsing** — Gemini 2.0 Flash extracts six structured fields from a plain-English description: payload mass, orbit type, target altitude, budget ceiling, max lead time, and inclination flexibility. Falls back to a regex heuristic when no API key is set.
- **Catalog filter + ranker** — eliminates vehicles that can't meet hard constraints (mass, orbit, budget, schedule), then scores the remaining options against user-weighted priorities (cost / schedule / orbit precision).
- **AI explanation** — Gemini writes a plain-language trade-off rationale for the top results. Template fallback when unavailable.
- **Improve my description** — an explicit "Improve my description" button calls `/api/improve`, which identifies missing fields and (when Gemini is available) returns a rewritten draft with bracketed prompts for gaps. A "Use this" button replaces the textarea content — never auto-submitted.
- **Post-parse nudge** — after a low- or medium-confidence parse, the result card shows exactly which fields were not found, with a one-click link back to the improve panel.
- **Session history** — past analyses are saved to `localStorage` and can be restored or cleared.
- **Export** — download results as JSON or Markdown.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Gemini API key *(optional — all three AI steps fall back gracefully without one)*

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in your key:

```
GEMINI_API_KEY=your_key_here
```

Without `GEMINI_API_KEY` the app still works fully — the parser uses regex heuristics, the explainer uses a template, and the improver returns the list of missing fields without a suggested rewrite.

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/parse` | Parse a mission description → `ParsedMission` |
| `POST` | `/api/rank` | Filter catalog + score → `RankResponse` |
| `POST` | `/api/explain` | Generate trade-off explanation → `ExplainResponse` |
| `POST` | `/api/improve` | Identify missing fields + optional rewrite → `ImproveResponse` |

---

## Project structure

```
data/
  catalog.schema.json     JSON Schema for a catalog entry
  catalog.json            Catalog of 7 launch vehicles / rideshare programs
src/
  app/
    page.tsx              Single-page UI
    api/
      parse/route.ts      Mission description parser endpoint
      rank/route.ts       Filter + ranker endpoint
      explain/route.ts    AI explanation endpoint
      improve/route.ts    Description improvement endpoint
  lib/
    types.ts              Shared TypeScript interfaces
    parser.ts             Gemini parser + regex fallback
    filter.ts             Hard-constraint catalog filter
    ranker.ts             Weighted scorer
    explainer.ts          Gemini explanation + template fallback
    improver.ts           Gemini description improver + fallback
  components/
    DownloadMenu.tsx       JSON / Markdown export
    SessionHistoryPanel.tsx  localStorage session history
  __tests__/
    parser.test.ts
    filter.test.ts
    ranker.test.ts
    explainer.test.ts
    improver.test.ts
```

---

## Development

```bash
npm run dev      # Next.js dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm test         # Jest test suite
```
