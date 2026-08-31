import { z } from "zod";
import type { ImproveResponse, ClarifyingQuestion, ParsedMission } from "@/lib/types";
import { heuristicParse } from "@/lib/parser";

// ---------------------------------------------------------------------------
// Zod schema for LLM JSON output
// ---------------------------------------------------------------------------
const ClarifyingQuestionSchema = z.object({
  field: z.string(),
  question: z.string(),
  placeholder: z.string(),
});

const ImproveResponseSchema = z.object({
  missing_fields: z.array(z.string()),
  clarifying_questions: z.array(ClarifyingQuestionSchema),
  suggested_rewrite: z.string(),
});

const SYSTEM_PROMPT = `You are a mission-description editor for a launch vehicle selection tool.
Given a user's mission description and a list of fields that are missing or ambiguous, return ONLY valid JSON — no markdown, no explanation.

Your tasks:
1. Carefully read the description and infer as many of the six required fields as possible from natural language, even when values are expressed informally.
   - payload_mass_kg: any mass/weight value in kg, lbs, tonnes, etc. (convert to kg). "70kg satellite" → 70.
   - orbit_type: any orbital regime — "LEO", "SSO", "MEO", "GEO", "GTO", "HEO", "any". Infer from context: "low earth orbit" → LEO, "geostationary" → GEO, "MEO orbit" → MEO, "bound for Jupiter/Mars/deep space" → HEO or note as interplanetary.
   - target_altitude_km: any altitude value in km or miles (convert to km). "800km MEO orbit" → 800.
   - budget_usd: any monetary value. "$15 million" → 15000000, "$15M" → 15000000, "fifteen million dollars" → 15000000.
   - schedule_months: any time constraint in months or years. "within 2 years" → 24, "6 months" → 6, "launch in 18 months" → 18.
   - inclination_flexibility_required: "fixed", "limited", "customer-defined", or "any". "flexible inclination" → "any", "inclination control is flexible" → "any", "specific inclination required" → "customer-defined", "any inclination" → "any".
2. Only list a field as missing if it truly cannot be inferred from the description. If the user said it in plain language, do NOT list it as missing.
3. For each genuinely missing field, produce a short, friendly clarifying question the user can answer directly, plus a concise placeholder example value.
4. Return a rewritten version of the description that preserves every fact the user already stated.
   For each missing field, insert a bracketed prompt in place of the value, e.g. "[budget not specified — add a $ ceiling]".
   Do not invent numbers or facts. Do not remove any information the user provided.

Return exactly this JSON structure:
{
  "missing_fields": [<array of field key strings that are truly missing or ambiguous>],
  "clarifying_questions": [
    { "field": "<field key>", "question": "<one-sentence question>", "placeholder": "<example answer>" }
  ],
  "suggested_rewrite": <rewritten description string with bracketed gap prompts>
}`;

// ---------------------------------------------------------------------------
// Static fallback clarifying questions (no API key, or on error)
// ---------------------------------------------------------------------------

const FALLBACK_QUESTIONS: Record<string, ClarifyingQuestion> = {
  payload_mass_kg: {
    field: "payload_mass_kg",
    question: "What is the mass of your payload?",
    placeholder: "e.g. 45 kg",
  },
  orbit_type: {
    field: "orbit_type",
    question: "What orbital regime are you targeting?",
    placeholder: "e.g. LEO, SSO, GEO, GTO",
  },
  target_altitude_km: {
    field: "target_altitude_km",
    question: "What is your desired orbital altitude?",
    placeholder: "e.g. 550 km",
  },
  budget_usd: {
    field: "budget_usd",
    question: "What is your maximum launch budget?",
    placeholder: "e.g. $2.5M",
  },
  schedule_months: {
    field: "schedule_months",
    question: "How many months do you have from contract to launch?",
    placeholder: "e.g. 12 months",
  },
  inclination_flexibility_required: {
    field: "inclination_flexibility_required",
    question: "How precisely must your orbital inclination be controlled?",
    placeholder: "e.g. fixed, flexible, customer-defined",
  },
};

/**
 * The `missing` list is computed client-side and can go stale — e.g. the user
 * uploads/edits the description without re-running analysis first, so it still
 * reflects an earlier (or empty) parse. Re-check the *current* text with the
 * cheap heuristic parser and drop any field it can plainly find, so we never
 * ask the user for something already sitting in the text box. A field the
 * heuristic can't find stays in the list — the LLM path below still gets a
 * chance to infer it more cleverly before treating it as truly missing.
 */
function reconcileMissingFields(text: string, missing: string[]): string[] {
  if (missing.length === 0) return missing;
  const found: ParsedMission = heuristicParse(text);
  const foundRecord = found as unknown as Record<string, unknown>;
  return missing.filter((key) => foundRecord[key] === null || foundRecord[key] === undefined);
}

function buildFallback(_text: string, missing: string[], error?: string): ImproveResponse {
  return {
    missing_fields: missing,
    clarifying_questions: missing
      .map((key) => FALLBACK_QUESTIONS[key])
      .filter((q): q is ClarifyingQuestion => q !== undefined),
    suggested_rewrite: null, // null per spec: LLM unavailable
    fallback: true,
    ...(error ? { error } : {}),
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function improveMissionDescription(
  text: string,
  missing: string[],
  model = "gemini-3.5-flash-lite"
): Promise<ImproveResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  const reconciledMissing = reconcileMissingFields(text, missing);

  if (!apiKey) {
    return buildFallback(text, reconciledMissing);
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });

    const userContent = `Mission description:\n${text}\n\nMissing or ambiguous fields: ${reconciledMissing.join(", ") || "none identified — review for clarity"}`;

    const response = await client.models.generateContent({
      model,
      contents: userContent,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 5000,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const parsed = ImproveResponseSchema.parse(JSON.parse(raw));

    return {
      missing_fields: parsed.missing_fields,
      clarifying_questions: parsed.clarifying_questions,
      suggested_rewrite: parsed.suggested_rewrite,
      fallback: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[improver] Gemini call failed:", message);
    return buildFallback(text, reconciledMissing, message);
  }
}
