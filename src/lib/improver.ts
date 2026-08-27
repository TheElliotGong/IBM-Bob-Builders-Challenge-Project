import { z } from "zod";
import type { ImproveResponse, ClarifyingQuestion } from "@/lib/types";

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
1. Identify which of the six required fields are missing or ambiguous: payload_mass_kg, orbit_type, target_altitude_km, budget_usd, schedule_months, inclination_flexibility_required.
2. For each missing field, produce a short, friendly clarifying question the user can answer directly, plus a concise placeholder example value.
3. Return a rewritten version of the description that preserves every fact the user already stated.
   For each missing field, insert a bracketed prompt in place of the value, e.g. "[budget not specified — add a $ ceiling]".
   Do not invent numbers or facts. Do not remove any information the user provided.

Return exactly this JSON structure:
{
  "missing_fields": [<array of field key strings that are missing or ambiguous>],
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
  missing: string[]
): Promise<ImproveResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return buildFallback(text, missing);
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });

    const userContent = `Mission description:\n${text}\n\nMissing or ambiguous fields: ${missing.join(", ") || "none identified — review for clarity"}`;

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: userContent,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 15000,
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
    return buildFallback(text, missing, message);
  }
}
