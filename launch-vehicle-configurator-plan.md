# Satellite Launch Vehicle / Rideshare Configurator
### IBM Builders Challenge with IBM Bob — August 2026: Mission Beyond Earth (Space Exploration)

---

## Concept

An AI-powered configurator that takes a small satellite mission's requirements (payload mass, target orbit, budget, timeline) and recommends the best-fit launch provider from a catalog of real options — with a plain-language explanation of the trade-offs.

This is a direct adaptation of a product configurator pattern (as used to tailor recommendations and orders for customers): swap "customer requirements → product catalog → recommendation + order" for "mission requirements → launch provider catalog → recommendation + mission brief."

**Category fit:** This sits in the early mission-design/architecture phase rather than day-to-day operations planning, so it's best framed explicitly in the submission as a mission-planning assistant for the design phase — e.g. "AI mission architecture configurator" — to make the connection to the "AI-powered mission planning assistant" category clear to judges rather than leaving it implicit.

---

## Architecture

1. **Input parser** — LLM converts a free-text mission description (e.g. "60 kg cubesat, need SSO around 500km, launching within 6 months, budget under $500k") into structured fields: payload mass, target orbit type/altitude, budget ceiling, schedule urgency.
2. **Catalog filter** — matches structured requirements against the provider catalog, eliminating options that can't physically meet mass/orbit constraints.
3. **Ranker** — scores remaining options against user-weighted priorities (cost vs. schedule control vs. orbit precision). Letting the user adjust weights mirrors how a buyer prioritizes price vs. features in a product configurator.
4. **Explainer** — LLM generates a plain-language rationale for the recommendation (e.g. "Electron costs more per kg but gives you a custom inclination and a shorter integration timeline than Transporter's fixed SSO slot").

---

## Starter Catalog

Seed data points to verify against each provider's official payload user's guide before submission (see note below):

| Provider | Type | Payload Capacity | Est. Cost | Orbit Fit |
|---|---|---|---|---|
| SpaceX Transporter | Rideshare | Base slot up to 50 kg, additional mass priced per kg | $350,000 for 50 kg + $7,000/kg beyond, to SSO | Sun-synchronous orbit, fixed schedule set by primary mission |
| Rocket Lab Electron | Dedicated small launch | Up to 300 kg to LEO | ~$7.5M per launch (~$25,000/kg) | Custom inclination/orbit, own schedule |
| Firefly Alpha | Dedicated, mid-size smallsat | 1,030 kg to 200 km LEO / 630 kg to 500 km SSO | ~$15–17.6M per launch | Custom orbit, larger payload capacity |

**Note on data accuracy:** the figures above come from market-analysis sources current as of mid-2026, not each provider's official rate card. Before locking in the catalog, pull final numbers from primary sources: SpaceX's Rideshare Payload User's Guide, Rocket Lab's Electron payload guide, and Firefly's Alpha payload user's guide. Add 2–3 more providers (e.g. Arianespace Vega C SSMS, ISRO PSLV/SSLV) if time allows, to strengthen the trade-space demo.

---

## Build Plan (1 Week)

| Day | Focus |
|---|---|
| 1 | Lock scope; define the JSON schema per provider (capacity, cost, orbit options, integration lead time, cadence); build the starter catalog (5–8 entries) from primary sources |
| 2–3 | Build the parser + filter + matcher in IBM Bob — the core of the AI work |
| 4 | Add the ranker (weighted priorities) and the LLM explanation layer |
| 5 | Test against 5–6 varied example missions (tiny cubesat/tight budget, larger payload/flexible budget, etc.); tune explanations |
| 6 | Polish UI; write the submission narrative, explicitly framing the tool as a mission-planning/architecture assistant |
| 7 | Buffer + submit |

---

## Completed Work Log

### Phase 1 — Core pipeline

- **`data/catalog.json`** — 7-entry catalog with full schema fields: SpaceX Transporter, Rocket Lab Electron, Firefly Alpha, Arianespace Vega-C SSMS, ISRO PSLV-C, Virgin Orbit LauncherOne (retired), D-Orbit/Exolaunch ION Satellite Carrier.
- **`data/catalog.schema.json`** — JSON Schema (draft-07) for a catalog entry; all catalog entries validated against it.
- **`src/lib/types.ts`** — canonical TypeScript interfaces: `LaunchVehicleEntry`, `ParsedMission`, `MatchedVehicle`, `PriorityWeights`, `RankedVehicle`, `RankResponse`, `ExplainResponse`, `ClarifyingQuestion`, `ImproveResponse`, `SessionRecord`.
- **`src/lib/parser.ts`** — Gemini structured-output parser (6 fields + confidence). Regex heuristic fallback when `GEMINI_API_KEY` absent.
- **`src/lib/filter.ts`** — hard-constraint catalog filter; eliminates vehicles that fail mass, orbit, budget, or schedule requirements; returns `MatchedVehicle[]` with per-constraint pass/fail and an `elimination_reason` string.
- **`src/lib/ranker.ts`** — weighted scorer; normalises cost, schedule, and orbit-precision scores to 0–100 per vehicle, applies user priority weights, and returns a ranked `RankedVehicle[]` list.
- **`src/lib/explainer.ts`** — Gemini explanation generator. Template fallback produces a structured trade-off summary without an LLM.
- **`src/lib/improver.ts`** — Gemini description improver; identifies missing fields, returns `ClarifyingQuestion[]` and an optional rewritten description with bracketed prompts. Static-question fallback when no API key.

### Phase 2 — API routes

- **`/api/parse`** — thin route handler; calls `parser.ts`, returns `ParsedMission`.
- **`/api/filter`** — calls `filter.ts`, returns `{ matches: MatchedVehicle[] }`.
- **`/api/rank`** — calls `filter.ts` + `ranker.ts`, returns `RankResponse` (`ranked` + `eliminated`). This is the primary endpoint used by the UI.
- **`/api/explain`** — calls `explainer.ts`, returns `ExplainResponse`.
- **`/api/improve`** — calls `improver.ts`, returns `ImproveResponse`.

### Phase 3 — UI

- **`src/app/page.tsx`** — single-page UI with: mission description textarea, `WeightSlider` controls, `ImprovePanel` (Gemini rewrite + progress bar + `ClarifyingQuestionsForm`), `MissionCard` (parsed fields + confidence badges), `RankedVehicleCard` (score bar, score breakdown, estimated cost), `EliminatedCard`, `ExplanationPanel`, post-parse confidence nudge (missing-fields inline hint with link to improve panel), `SessionHistoryPanel`, and `DownloadMenu`.
- **`src/components/DownloadMenu.tsx`** — export menu for six formats; delegates to `exporters.ts`.
- **`src/components/SessionHistoryPanel.tsx`** — `localStorage`-backed session history; restore or clear past analyses.
- **`src/lib/exporters.ts`** — all client-side export logic: JSON, Markdown, TXT, CSV, PDF (jsPDF), DOCX (docx library).

### Phase 4 — Settings, rate limiting, and infrastructure

- **`src/lib/uiSettings.tsx`** — `UISettingsProvider` React context; manages `theme` (dark / light / system), `density` (compact / default / spacious), `language` (BCP-47), and `geminiModel` (3.6 / 3.5 / 3.1 Flash). Persists to `localStorage` key `launch-selector-ui-settings`. Applies `dark-mode`/`light-mode` and `density-*` classes to `<html>` for CSS-driven theming.
- **`src/components/SettingsPanel.tsx`** — slide-in settings drawer with focus trap, Escape-key close, and backdrop dismiss. Used on mobile / smaller viewports.
- **`src/components/SettingsSidebar.tsx`** — always-visible sticky settings sidebar rendered alongside the main content on wider screens.
- **`src/lib/rateLimit.ts`** — in-memory sliding-window rate limiter; default 20 req/60 s per IP. Applied to `/api/parse`, `/api/explain`, and `/api/improve`. Returns HTTP 429 with `Retry-After` on limit breach. Opportunistically purges expired entries when the store exceeds 10 000 entries.
- **`src/app/layout.tsx`** — root layout; wraps the app in `UISettingsProvider`.
- **`src/app/global-error.tsx`** — global 500 error boundary with "Try again" retry action.
- **`src/app/not-found.tsx`** — custom 404 page with link back to the configurator.
- **`src/data/catalog.json`** — runtime copy of the catalog (identical to root `data/catalog.json`).
- **`src/data/index.ts`** — typed re-export: `export const LAUNCH_CATALOG: LaunchVehicleEntry[]`.

### Phase 5 — Tests

- 9 Jest test suites, 171 tests, all passing.
  - `parser.test.ts` — regex fallback; edge-case inputs.
  - `parser.llm.test.ts` — Gemini path via mocked `@google/genai` SDK.
  - `filter.test.ts` — hard-constraint matrix; all pass/fail combinations.
  - `ranker.test.ts` — weight normalisation, tie-breaking, score-breakdown accuracy.
  - `explainer.test.ts` — template fallback; field substitution.
  - `explainer.llm.test.ts` — Gemini path (mocked).
  - `improver.test.ts` — static-question fallback; field detection.
  - `improver.llm.test.ts` — Gemini path (mocked).
  - `prompt-delivery.test.ts` — end-to-end: verifies user prompt reaches Gemini verbatim through the API route stack.
  - `__mocks__/@google/genai.ts` — manual Jest mock; no network or API key needed in any test.

---

## Next Steps
- Confirm exact submission requirements on the official challenge page (deliverable format, required use of IBM Bob/watsonx, demo video, etc.)
- Consider adding a light-mode CSS pass once Tailwind `light-mode` class overrides are wired up.
- Consider global rate-limit persistence (Vercel KV / Redis) if the app is deployed publicly.
