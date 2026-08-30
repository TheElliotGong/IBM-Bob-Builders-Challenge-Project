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

1. **Parse** — free-text mission description → six structured fields (payload mass, orbit type/altitude, budget ceiling, schedule urgency, inclination flexibility) via Gemini Flash; regex fallback when no API key is present.
2. **Filter** — eliminate catalog entries that physically can't meet the mass or orbit constraints.
3. **Rank** — score remaining options by user-weighted priorities (cost vs. schedule control vs. orbit precision).
4. **Explain** — plain-language rationale for why the top pick wins and how alternatives compare.
5. **Improve** — identify missing fields and return a rewritten draft with bracketed prompts; a clarifying-questions form collects individual field answers that are merged back into the description. A post-parse nudge also surfaces gaps inline on the result card.

### AI approach and architecture

The pipeline uses **Gemini Flash** (via the Google Generative AI API) for three distinct tasks:

1. **Natural-language parsing** (`/api/parse`) — a structured-output prompt extracts six mission fields (payload mass, orbit type, target altitude, budget ceiling, max lead time, inclination flexibility) from a free-text description. Confidence is reported per-field so the UI can surface ambiguities.
2. **Trade-off explanation** (`/api/explain`) — given the ranked results, Gemini writes a concise, mission-specific rationale covering why the top vehicle was selected and how the alternatives compare.
3. **Description improvement** (`/api/improve`) — Gemini identifies which fields are missing and returns a rewritten draft with bracketed prompts for each gap, helping users self-correct before re-submitting.

The active Gemini model (Gemini 3.6 Flash, 3.5 Flash, or 3.1 Flash) is user-selectable from the Settings panel and persisted to `localStorage`. All three AI steps degrade gracefully: if no `GEMINI_API_KEY` is present, the parser falls back to a regex heuristic, the explainer uses a template, and the improver returns a plain list of missing fields. The filter and ranking steps are fully deterministic and never require an LLM.

### Selected challenge theme

**Space Exploration** — the tool targets the early mission-design phase of a small satellite programme, helping payload owners make faster, better-informed launch-vehicle decisions before committing to a provider or procurement process.

Submitted under the **"AI-powered mission planning assistant"** category.

### How IBM Bob was used

IBM Bob (the AI coding assistant embedded in the development environment) was used throughout the build:

- **Architecture and scoping** — Bob helped translate the challenge brief into a concrete feature list and a day-by-day build plan, and proposed the parse → filter → rank → explain pipeline structure.
- **Code generation** — Bob generated initial implementations of the Gemini prompt wrappers (`parser.ts`, `explainer.ts`, `improver.ts`), the catalog filter (`filter.ts`), and the weighted ranker (`ranker.ts`), as well as the Next.js API route handlers.
- **Test suite** — Bob wrote the Jest test suite (171 tests), covering both the offline fallback paths and the Gemini paths against a mocked SDK, the hard-constraint filter and ranker, and an end-to-end check that the user's prompt reaches Gemini verbatim through the API routes.
- **UI iteration** — Bob implemented the `ImprovePanel`, `ClarifyingQuestionsForm`, `SessionHistoryPanel`, `DownloadMenu`, `SettingsPanel`, `SettingsSidebar`, and the post-parse confidence nudge, and iterated on layout and accessibility based on feedback.
- **Infrastructure** — Bob added the in-memory rate limiter (`rateLimit.ts`), the `UISettingsProvider` context with `localStorage` persistence, and custom 404/500 error pages.
- **Documentation** — Bob authored and maintained `README.md` and `launch-vehicle-configurator-plan.md` throughout the project.

---

## Features

- **Natural-language parsing** — extracts six structured fields from a plain-English description: payload mass, orbit type, target altitude, budget ceiling, max lead time, and inclination flexibility.
- **Document upload** — upload a `.txt`, `.md`, `.pdf`, or `.docx` mission brief; text is extracted server-side (via `pdf-parse` / `mammoth`) and populated into the description textarea for review before analysis. Files up to 10 MB; extracted text capped at 50 000 characters. Drag-and-drop supported. Sample files for trying this out are in [`prompt_upload_files/`](prompt_upload_files) — see [Testing document upload](#testing-document-upload).
- **Catalog filter + ranker** — eliminates vehicles that can't meet hard constraints (mass, orbit, budget, schedule), then scores the remaining options against user-weighted priorities (cost / schedule / orbit precision).
- **AI explanation** — plain-language trade-off rationale for the top results.
- **Improve my description** — identifies missing fields and returns a rewritten draft with bracketed prompts for gaps; a "Use this" button replaces the textarea content — never auto-submitted. A structured **clarifying-questions form** lets users fill in individual fields that are merged into the description.
- **Post-parse nudge** — after a low- or medium-confidence parse, the result card shows which fields were not found, with a one-click link back to the improve panel.
- **Session history** — past analyses are saved to `localStorage` and can be restored or cleared.
- **Export** — download results in six formats: JSON, Markdown, plain-text (TXT), CSV, PDF, and DOCX.
- **Settings panel** — slide-in drawer (mobile) and always-visible sidebar (desktop) for appearance (dark / light / system), UI density (compact / default / spacious), language/locale, and active Gemini model. All settings persist to `localStorage`.
- **Rate limiting** — in-memory sliding-window rate limiter on all AI API routes (20 req/min per IP by default) to protect the Gemini API key.
- **Error pages** — custom 404 (not-found) and 500 (global error boundary) pages.

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

Create a `.env` file in the project root and add your key:

```
GEMINI_API_KEY=your_key_here
```

Without `GEMINI_API_KEY` the app still works fully — see [AI approach](#ai-approach-and-architecture) for fallback behaviour.

### Testing document upload

[`prompt_upload_files/`](prompt_upload_files) contains sample files to upload through the app's document-upload control (or POST directly to `/api/extract`) without needing your own mission brief on hand:

| File | Purpose |
|---|---|
| `mission-clear.txt` | All six fields stated plainly — expect a high-confidence parse. |
| `mission-vague.md` | Casual phrasing (lbs, "a year and a half") — exercises unit conversion / lower-confidence parsing. |
| `mission-rfp.pdf` | GTO comsat mission written as RFP prose — exercises PDF extraction (`pdf-parse`). |
| `mission-specs.docx` | LEO rideshare spec sheet with bold field labels — exercises DOCX extraction (`mammoth`). |
| `unsupported.xlsx` | Not a real spreadsheet — should trigger the 415 "unsupported file type" error. |
| `empty.txt` | No content — should trigger the 422 "no text could be extracted" error. |

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/parse` | Parse a mission description → `ParsedMission` |
| `POST` | `/api/extract` | Extract text from an uploaded file (multipart `file` field) → `{ text, truncated }` |
| `POST` | `/api/filter` | Apply hard constraints to the catalog → `{ matches }` |
| `POST` | `/api/rank` | Filter catalog + score → `RankResponse` (runs filter internally) |
| `POST` | `/api/explain` | Generate trade-off explanation → `ExplainResponse` |
| `POST` | `/api/improve` | Identify missing fields + optional rewrite → `ImproveResponse` |

> **Note:** `/api/filter` is a standalone public endpoint for programmatic use. The UI calls `/api/rank`, which runs the filter step internally; calling `/api/filter` separately is not required for normal app operation.
>
> All AI routes (`/api/parse`, `/api/explain`, `/api/improve`) and `/api/extract` are protected by an in-memory rate limiter (20 requests per 60-second window per IP). Exceeding the limit returns HTTP 429 with a `Retry-After` header.
>
> `/api/extract` accepts `.txt`, `.md`, `.pdf`, and `.docx` files up to 10 MB. Returns `{ text: string, truncated: boolean }`. Errors: 415 (unsupported type), 413 (oversized), 422 (empty extraction).

---

## Project structure

```
data/
  catalog.schema.json     JSON Schema (draft-07) for a catalog entry
  catalog.json            Catalog of 7 launch vehicles / rideshare programs (root copy)
prompt_upload_files/      Sample .txt/.md/.pdf/.docx files for testing the document-upload feature
src/
  app/
    page.tsx              Single-page UI
    layout.tsx            Root layout — wraps app with UISettingsProvider
    global-error.tsx      Global 500 error boundary
    not-found.tsx         Custom 404 page
    globals.css           Global styles (theme + density CSS classes)
    api/
      parse/route.ts      Mission description parser endpoint
      extract/route.ts    Document upload text-extraction endpoint
      filter/route.ts     Hard-constraint catalog filter endpoint
      rank/route.ts       Filter + ranker endpoint (filter runs internally)
      explain/route.ts    AI explanation endpoint
      improve/route.ts    Description improvement endpoint
  lib/
    types.ts              Shared TypeScript interfaces
    parser.ts             Gemini parser + regex fallback
    extract.ts            Server-side text extraction (txt/md/pdf/docx) with size limits
    filter.ts             Hard-constraint catalog filter
    ranker.ts             Weighted scorer
    explainer.ts          Gemini explanation + template fallback
    improver.ts           Gemini description improver + fallback
    exporters.ts          Client-side export helpers (JSON, MD, TXT, CSV, PDF, DOCX)
    rateLimit.ts          In-memory sliding-window rate limiter for API routes
    uiSettings.tsx        UISettingsProvider context (theme, density, language, model)
  components/
    DownloadMenu.tsx              Export menu (JSON, Markdown, TXT, CSV, PDF, DOCX)
    SessionHistoryPanel.tsx       localStorage session history
    SettingsPanel.tsx             Slide-in settings drawer (mobile/overlay)
    SettingsSidebar.tsx           Always-visible settings sidebar (desktop)
  data/
    catalog.json          Catalog source used at runtime (imported by src/data/index.ts)
    index.ts              Typed re-export of catalog.json as LaunchVehicleEntry[]
  __tests__/
    parser.test.ts          Heuristic fallback parser
    parser.llm.test.ts      Gemini parser path (mocked SDK)
    extract.test.ts         MIME resolution, size limits, and per-type extraction (pdf/docx mocked)
    filter.test.ts
    ranker.test.ts
    explainer.test.ts       Template fallback
    explainer.llm.test.ts   Gemini explanation path (mocked SDK)
    improver.test.ts        Static-question fallback
    improver.llm.test.ts    Gemini improver path (mocked SDK)
    prompt-delivery.test.ts End-to-end: route → lib → Gemini, prompt verbatim
    helpers/genaiMock.ts    Typed handle on the SDK mock
__mocks__/@google/genai.ts  Manual mock — Jest substitutes it automatically,
                            so no test ever needs a key or the network
```

---

## Catalog

Seven entries covering the realistic trade-space for smallsat / CubeSat missions:

| ID | Provider | Vehicle | Type | Max Payload | Est. Cost |
|---|---|---|---|---|---|
| `spacex-transporter` | SpaceX | Falcon 9 Transporter | rideshare | 200 kg SSO | ~$6,000/kg |
| `rocketlab-electron` | Rocket Lab | Electron | dedicated-small | 300 kg LEO | ~$8M/launch |
| `firefly-alpha` | Firefly Aerospace | Firefly Alpha | dedicated-small | 1,030 kg LEO | ~$15M/launch |
| `arianespace-vega-c-ssms` | Arianespace / ESA | Vega-C SSMS | rideshare | 700 kg SSO | ~$20,000/kg |
| `isro-pslv-cl` | ISRO / NSIL | PSLV-C (commercial) | rideshare | 1,750 kg SSO | ~$15,000/kg |
| `virgin-orbit-launcher-one` | Virgin Orbit | LauncherOne | dedicated-small | 500 kg LEO | *retired* |
| `exolaunch-rideshare-d-orbit` | D-Orbit / Exolaunch | ION Satellite Carrier | rideshare | 450 kg SSO | ~$10,000/kg |

The catalog lives in two places: `data/catalog.json` (root, for reference) and `src/data/catalog.json` (imported at runtime via `src/data/index.ts`). Both files are identical; the root copy is the canonical schema-validated source.

> **Data accuracy note:** figures are sourced from publicly available payload user's guides, commercial rate cards, and investor materials current as of mid-2025. Verify final numbers from each provider's official Payload User's Guide before any real mission commitment. The Virgin Orbit entry is retained as a retired historical reference only.

---

## Development

```bash
npm run dev      # Next.js dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm test         # Jest test suite (193 tests, 10 suites)
```
