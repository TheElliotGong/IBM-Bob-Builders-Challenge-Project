import { z } from "zod";
import type { ImproveResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Zod schema for LLM JSON output
// ---------------------------------------------------------------------------
const ImproveResponseSchema = z.object({
  missing_fields: z.array(z.string()),
  suggested_rewrite: z.string(),
});

const SYSTEM_PROMPT = `You are a mission-description editor for a launch vehicle selection tool.
Given a user's mission description and a list of fields that are missing or ambiguous, return ONLY valid JSON — no markdown, no explanation.

Your tasks:
1. Identify which of the six required fields are missing or ambiguous: payload_mass_kg, orbit_type, target_altitude_km, budget_usd, schedule_months, inclination_flexibility_required.
2. Return a rewritten version of the description that preserves every fact the user already stated.
   For each missing field, insert a bracketed prompt in place of the value, e.g. "[budget not specified — add a $ ceiling]".
   Do not invent numbers or facts. Do not remove any information the user provided.

Return exactly this JSON structure:
{
  "missing_fields": [<array of field name strings that are missing or ambiguous>],
  "suggested_rewrite": <rewritten description string with bracketed gap prompts>
}`;

// ---------------------------------------------------------------------------
// Fallback builder (no API key, or on error)
// ---------------------------------------------------------------------------

function buildFallback(_text: string, missing: string[], error?: string): ImproveResponse {
  return {
    missing_fields: missing,
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
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const parsed = ImproveResponseSchema.parse(JSON.parse(raw));

    return {
      missing_fields: parsed.missing_fields,
      suggested_rewrite: parsed.suggested_rewrite,
      fallback: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[improver] Gemini call failed:", message);
    return buildFallback(text, missing, message);
  }
}
