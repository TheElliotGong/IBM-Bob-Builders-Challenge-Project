# AI Launch Vehicle / Rideshare Selector

An AI-powered mission-planning tool for the IBM Builders Challenge (Space Exploration track). Type a free-text satellite mission description and the pipeline parses your requirements, filters a curated launch-vehicle catalog, ranks options by your weighted priorities, and explains the trade-offs — all in one page.

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
