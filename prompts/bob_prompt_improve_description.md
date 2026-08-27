# Prompt for IBM Bob — Add a lightweight "Improve my description" feature

Paste everything below into Bob as one task.

---

## Context

This is the Satellite Launch Vehicle / Rideshare Configurator (IBM Builders Challenge project). Users type a free-text mission description into a textarea on the home page; `POST /api/parse` sends it to Gemini (`src/lib/parser.ts`, model `gemini-2.0-flash`) which extracts six fields into a `ParsedMission` (payload mass, orbit type, target altitude, budget, schedule months, inclination flexibility) plus a `parse_confidence` of `"high" | "medium" | "low"`. When `GEMINI_API_KEY` isn't set, `parser.ts` falls back to a regex heuristic (`heuristicParse`) and confidence is capped at `"low"`.

The UI already has two static aids next to the textarea in `src/app/page.tsx`: a `PLACEHOLDER` example string and a `PromptFieldsHint` component that lists the six `REQUIRED_FIELDS` (name/hint/example) the parser looks for. There is no dynamic help today — if a user writes something vague, they only find out after submitting, when `ConfidenceBadge` shows "LOW CONFIDENCE" and several `FieldRow`s in `MissionCard` render as `—`.

## Goal

Add a lightweight "Improve my description" feature that helps the user write a better mission description *before* (or right after) they submit — without turning into a full multi-step guided prompt builder. Two tiers, both required:

**Tier 1 — free, no extra Gemini call.** After `/api/parse` returns, if `parse_confidence` is `"medium"` or `"low"`, show which specific `REQUIRED_FIELDS` came back `null` on the `ParsedMission`, inline, next to (or inside) `MissionCard`. This reuses data you already have — no new backend logic beyond reading the existing response.

**Tier 2 — optional, Gemini-backed.** Add an explicit "Improve my description" button near the textarea (before or after first submission) that calls a new `POST /api/improve` endpoint. It sends the user's raw text to Gemini with a system prompt whose job is to (a) name which of the six fields are missing or ambiguous and (b) return one rewritten version of the description that preserves every fact the user already gave and fills the gaps with bracketed prompts, e.g. `[budget not specified — add a $ ceiling]`, rather than inventing numbers. Show the rewrite in a small panel below the textarea with an "Use this" action that replaces the textarea contents (the user can still edit before submitting — never auto-submit on their behalf).

## Files to add

- `src/lib/improver.ts` — mirror the shape of `src/lib/explainer.ts` and `src/lib/parser.ts`:
  - A `SYSTEM_PROMPT` constant describing the rewrite/gap-finding task above. Keep the tone matching the existing parser's system prompt (terse, JSON-oriented instructions).
  - `improveMissionDescription(text: string, missing: string[]): Promise<ImproveResponse>` as the main export, following `explainRecommendation`'s pattern exactly: read `process.env.GEMINI_API_KEY`; if absent, return a fallback built purely from `missing` (no LLM call) with `fallback: true`; otherwise call `client.models.generateContent` with `model: "gemini-2.0-flash"`, a low temperature (e.g. `0.3`), `responseMimeType: "application/json"`, and a Zod schema for the response (mirror `ParsedMissionSchema` in `parser.ts`); wrap in try/catch and fall back to the same local builder on any error.
  - A local `buildFallback(text: string, missing: string[]): ImproveResponse` that lists the missing fields in plain language (reuse the wording style from `explainer.ts`'s `buildFallback`, including the same `*(AI explanation unavailable — set GEMINI_API_KEY ...)*`-style note) — this is what runs both when there's no API key and when the Gemini call fails.

- `src/app/api/improve/route.ts` — mirror `src/app/api/explain/route.ts` exactly: `NextRequest`/`NextResponse`, validate `description: string` (400 on missing/wrong type, same message style as `/api/parse`'s `route.ts`), call `improveMissionDescription`, `console.error("[/api/improve]", err)` on failure, 500 on exception.

- `src/__tests__/improver.test.ts` — mirror `src/__tests__/explainer.test.ts`'s structure: test the fallback path (no key), test that fields present in the input are not flagged as missing, and test malformed-response handling falls back gracefully. Follow the existing jest setup in `jest.config.ts`.

## Files to modify

- `src/lib/types.ts` — add:
  ```ts
  export interface ImproveResponse {
    missing_fields: string[];       // names matching REQUIRED_FIELDS[].name
    suggested_rewrite: string | null; // null when fallback (no LLM available)
    fallback: boolean;
  }
  ```

- `src/app/page.tsx`:
  - Move (or export) `REQUIRED_FIELDS` if `improver.ts`/the new UI piece needs the same field list — keep it defined once, don't duplicate the array.
  - Add an `ImprovePanel` (or similarly named) component: an "Improve my description" button next to/below the textarea, a loading state consistent with the existing `loading`/`loadingStep` pattern, and a result state showing `missing_fields` as a short bullet-free inline list (match the visual language of `PromptFieldsHint`, not a new style) plus, when `suggested_rewrite` is non-null, a text preview with a "Use this" button that calls `setDescription(rewrite)`.
  - Wire Tier 1: inside `MissionCard` (or immediately beside it), when `mission.parse_confidence !== "high"`, compute missing fields from the null-valued `ParsedMission` keys against `REQUIRED_FIELDS` and render them with a nudge into the Tier-2 button — no new network call for this part.
  - Follow existing accessibility patterns already in this file (e.g. the `aria-expanded`/`aria-controls` pattern on the score-breakdown toggle) for any new expand/collapse or button state.

- `.env.local.example` — no change needed; it already documents `GEMINI_API_KEY` and the fallback behavior, which this feature reuses as-is.

## Explicit non-goals (keep this lightweight)

- No new page/route beyond `/api/improve`; no multi-step wizard or guided-builder UI.
- No new client-side state persisted to `SessionRecord`/`localStorage` — this is a pre-submission aid, not part of saved sessions.
- Don't change `/api/parse` or `parser.ts` — `/api/improve` is a separate, additive endpoint.
- Don't auto-call `/api/improve` on every keystroke or on blur — it's explicit-button-triggered only, to avoid burning Gemini quota.
- Don't auto-replace the user's textarea content — the rewrite is always an opt-in suggestion via an explicit "Use this" click.

## Acceptance criteria

1. Typing a vague description (e.g. "small sat, cheap, soon") and clicking "Improve my description" returns a list of missing fields and, when `GEMINI_API_KEY` is set, a rewritten draft with bracketed gaps for what's missing.
2. With no `GEMINI_API_KEY` set, the same button still works and returns `missing_fields` with `suggested_rewrite: null` and `fallback: true` — no crash, no network error surfaced to the user.
3. After a low/medium-confidence `/api/parse` result, the missing fields implied by null `ParsedMission` values are visible without any additional Gemini call.
4. `npm run lint` and the Jest suite (including the new `improver.test.ts`) pass.
5. No new npm dependencies added — reuse `@google/genai` and `zod`, already in `package.json`.
