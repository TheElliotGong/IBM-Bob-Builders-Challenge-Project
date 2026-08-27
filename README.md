# Satellite Launch Vehicle / Rideshare Configurator

An AI-powered mission-planning tool for the IBM Builders Challenge (Space Exploration track). Type a free-text satellite mission description and the pipeline parses your requirements, filters a curated launch-vehicle catalog, ranks options by your weighted priorities, and explains the trade-offs — all in one page.

---
## Author
* **Elliot Gong**
* Github: [@TheElliotGong](https://github.com/TheElliotGong)
* Website: [theelliotgong.com](https://theelliotgong.com)
* Linkedin: [@ElliotGong](https://www.linkedin.com/in/elliot-gong/)
* Reach Out to Me: [Contact Form](https://formsubmit.co/el/waguyo)

## IBM AI Builders Challenge — August 2026

### Problem statement

Small satellite and CubeSat missions typically begin with a frustrating, time-consuming manual survey of launch providers. A payload owner must cross-reference dozens of payload user's guides, rate cards, and schedule announcements to answer a deceptively simple question: *"Which rocket can actually carry my satellite to the right orbit, on budget, in time?"* The information is scattered, technical, and changes frequently — making the early architecture-trade phase unnecessarily slow and error-prone, even for experienced mission designers.

### Solution description

The Satellite Launch Vehicle / Rideshare Configurator is a single-page web application that collapses that multi-day research exercise into seconds. A user describes their mission in plain English; the tool parses the requirements into structured fields, filters a curated catalog of real launch vehicles and rideshare programmes, ranks the remaining options against the user's weighted priorities (cost, schedule, orbit precision), and returns a plain-language explanation of why the top pick wins and what the trade-offs are against the alternatives. An "Improve my description" panel identifies missing fields before submission, and a post-parse nudge surfaces gaps inline after submission — both paths push the user toward a better-specified mission without interrupting the workflow.

### Pipeline overview

1. **Parse** — free-text mission description → six structured fields (payload mass, orbit type/altitude, budget ceiling, schedule urgency, inclination flexibility) via Gemini 2.0 Flash; regex fallback when no API key is present.
2. **Filter** — eliminate catalog entries that physically can't meet the mass or orbit constraints.
3. **Rank** — score remaining options by user-weighted priorities (cost vs. schedule control vs. orbit precision).
4. **Explain** — plain-language rationale for why the top pick wins and how alternatives compare.
5. **Improve** — identify missing fields and return a rewritten draft with bracketed prompts; a post-parse nudge also surfaces gaps inline on the result card.

### AI approach and architecture

The pipeline uses **Gemini 2.0 Flash** (via the Google Generative AI API) for three distinct tasks:

1. **Natural-language parsing** (`/api/parse`) — a structured-output prompt extracts six mission fields (payload mass, orbit type, target altitude, budget ceiling, max lead time, inclination flexibility) from a free-text description. Confidence is reported per-field so the UI can surface ambiguities.
2. **Trade-off explanation** (`/api/explain`) — given the ranked results, Gemini writes a concise, mission-specific rationale covering why the top vehicle was selected and how the alternatives compare.
3. **Description improvement** (`/api/improve`) — Gemini identifies which fields are missing and returns a rewritten draft with bracketed prompts for each gap, helping users self-correct before re-submitting.

All three AI steps degrade gracefully: if no `GEMINI_API_KEY` is present, the parser falls back to a regex heuristic, the explainer uses a template, and the improver returns a plain list of missing fields. The filter and ranking steps are fully deterministic and never require an LLM.

### Selected challenge theme

**Space Exploration** — the tool targets the early mission-design phase of a small satellite programme, helping payload owners make faster, better-informed launch-vehicle decisions before committing to a provider or procurement process.

Submitted under the **"AI-powered mission planning assistant"** category.

### How IBM Bob was used

IBM Bob (the AI coding assistant embedded in the development environment) was used throughout the build:

- **Architecture and scoping** — Bob helped translate the challenge brief into a concrete feature list and a day-by-day build plan, and proposed the parse → filter → rank → explain pipeline structure.
- **Code generation** — Bob generated initial implementations of the Gemini prompt wrappers (`parser.ts`, `explainer.ts`, `improver.ts`), the catalog filter (`filter.ts`), and the weighted ranker (`ranker.ts`), as well as the Next.js API route handlers.
- **Test suite** — Bob wrote the Jest test suite (73 tests across five modules), including edge-case coverage for the regex fallback parser and the hard-constraint filter.
- **UI iteration** — Bob implemented the `ImprovePanel`, `SessionHistoryPanel`, `DownloadMenu`, and the post-parse confidence nudge, and iterated on layout and accessibility based on feedback.
- **Documentation** — Bob authored both `README.md` and `REPO_README.md`, and maintained the `launch-vehicle-configurator-plan.md` build log throughout the project.

---

## Features

- **Natural-language parsing** — extracts six structured fields from a plain-English description: payload mass, orbit type, target altitude, budget ceiling, max lead time, and inclination flexibility.
- **Catalog filter + ranker** — eliminates vehicles that can't meet hard constraints (mass, orbit, budget, schedule), then scores the remaining options against user-weighted priorities (cost / schedule / orbit precision).
- **AI explanation** — plain-language trade-off rationale for the top results.
- **Improve my description** — identifies missing fields and returns a rewritten draft with bracketed prompts for gaps; a "Use this" button replaces the textarea content — never auto-submitted.
- **Post-parse nudge** — after a low- or medium-confidence parse, the result card shows which fields were not found, with a one-click link back to the improve panel.
- **Session history** — past analyses are saved to `localStorage` and can be restored or cleared.
- **Export** — download results in six formats: JSON, Markdown, plain-text (TXT), CSV, PDF, and DOCX.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Gemini API key *(optional)*

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

Without `GEMINI_API_KEY` the app still works fully — see [AI approach](#ai-approach-and-architecture) for fallback behaviour.

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/parse` | Parse a mission description → `ParsedMission` |
| `POST` | `/api/filter` | Apply hard constraints to the catalog → `{ matches }` |
| `POST` | `/api/rank` | Filter catalog + score → `RankResponse` (runs filter internally) |
| `POST` | `/api/explain` | Generate trade-off explanation → `ExplainResponse` |
| `POST` | `/api/improve` | Identify missing fields + optional rewrite → `ImproveResponse` |

> **Note:** `/api/filter` is a standalone public endpoint for programmatic use. The UI calls `/api/rank`, which runs the filter step internally; calling `/api/filter` separately is not required for normal app operation.

---

## Project structure

```
data/
  catalog.schema.json     JSON Schema (draft-07) for a catalog entry
  catalog.json            Catalog of 7 launch vehicles / rideshare programs
src/
  app/
    page.tsx              Single-page UI
    api/
      parse/route.ts      Mission description parser endpoint
      filter/route.ts     Hard-constraint catalog filter endpoint
      rank/route.ts       Filter + ranker endpoint (filter runs internally)
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
    DownloadMenu.tsx       Export (JSON, Markdown, TXT, CSV, PDF, DOCX)
    SessionHistoryPanel.tsx  localStorage session history
  __tests__/
    parser.test.ts
    filter.test.ts
    ranker.test.ts
    explainer.test.ts
    improver.test.ts
```

---

## Catalog

Seven entries covering the realistic trade-space for smallsat / CubeSat missions:

| ID | Provider | Vehicle | Type | Max Payload | Est. Cost |
|---|---|---|---|---|---|
| `spacex-transporter` | SpaceX | Falcon 9 Transporter | rideshare | 200 kg SSO | ~$6,000/kg |
| `rocketlab-electron` | Rocket Lab | Electron | dedicated-small | 300 kg LEO | ~$8M/launch |
| `firefly-alpha` | Firefly Aerospace | Alpha | dedicated-small | 1,030 kg LEO | ~$15M/launch |
| `arianespace-vega-c-ssms` | Arianespace / ESA | Vega-C SSMS | rideshare | 700 kg SSO | ~$20,000/kg |
| `isro-pslv-cl` | ISRO / NSIL | PSLV-C (commercial) | rideshare | 1,750 kg SSO | ~$15,000/kg |
| `virgin-orbit-launcher-one` | Virgin Orbit | LauncherOne | dedicated-small | 500 kg LEO | *retired* |
| `exolaunch-rideshare-d-orbit` | D-Orbit / Exolaunch | ION Satellite Carrier | rideshare | 450 kg SSO | ~$10,000/kg |

> **Data accuracy note:** figures are sourced from publicly available payload user's guides, commercial rate cards, and investor materials current as of mid-2025. Verify final numbers from each provider's official Payload User's Guide before any real mission commitment. The Virgin Orbit entry is retained as a retired historical reference only.

---

## Development

```bash
npm run dev      # Next.js dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm test         # Jest test suite
```
