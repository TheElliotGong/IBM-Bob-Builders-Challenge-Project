import { z } from "zod";
import type { ParsedMission } from "@/lib/types";

// ---------------------------------------------------------------------------
// Zod schema for LLM JSON output
// ---------------------------------------------------------------------------
const ParsedMissionSchema = z.object({
  payload_mass_kg: z.number().nullable(),
  orbit_type: z
    .enum(["LEO", "SSO", "MEO", "GTO", "GEO", "HEO", "any"])
    .nullable(),
  target_altitude_km: z.number().nullable(),
  budget_usd: z.number().nullable(),
  schedule_months: z.number().nullable(),
  inclination_flexibility_required: z
    .enum(["fixed", "limited", "customer-defined", "any"])
    .nullable(),
  parse_confidence: z.enum(["high", "medium", "low"]),
});

const SYSTEM_PROMPT = `You are a mission-requirements parser for a launch vehicle selection tool.
Extract the following fields from the user's mission description and return ONLY valid JSON — no markdown, no explanation.

Fields to extract:
- payload_mass_kg: numeric kg of the payload (null if not specified)
- orbit_type: one of "LEO", "SSO", "MEO", "GTO", "GEO", "HEO", "any" (null if unclear)
- target_altitude_km: numeric km if an altitude is mentioned (null otherwise)
- budget_usd: maximum budget in USD as a number (null if not specified; convert M/million to full number)
- schedule_months: maximum acceptable months from contract to launch (null if not specified)
- inclination_flexibility_required: one of "fixed", "limited", "customer-defined", "any" (null if unspecified)
- parse_confidence: "high" if most fields are clearly stated, "medium" if some inference was required, "low" if very little concrete data

Return exactly this JSON structure:
{
  "payload_mass_kg": <number|null>,
  "orbit_type": <"LEO"|"SSO"|"MEO"|"GTO"|"GEO"|"HEO"|"any"|null>,
  "target_altitude_km": <number|null>,
  "budget_usd": <number|null>,
  "schedule_months": <number|null>,
  "inclination_flexibility_required": <"fixed"|"limited"|"customer-defined"|"any"|null>,
  "parse_confidence": <"high"|"medium"|"low">
}`;

// ---------------------------------------------------------------------------
// Regex / heuristic fallback (no API key)
// ---------------------------------------------------------------------------
function heuristicParse(text: string): ParsedMission {
  const lower = text.toLowerCase();

  // mass
  const massMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:kg)/i) ||
    text.match(/mass[^\d]*(\d+(?:\.\d+)?)/i);
  const payload_mass_kg = massMatch ? parseFloat(massMatch[1]) : null;

  // orbit
  let orbit_type: ParsedMission["orbit_type"] = null;
  if (/\bsso\b|sun.?synchronous/i.test(text)) orbit_type = "SSO";
  else if (/\bgeo\b|geostationary/i.test(text)) orbit_type = "GEO";
  else if (/\bgto\b|geostationary transfer/i.test(text)) orbit_type = "GTO";
  else if (/\bmeo\b|medium earth/i.test(text)) orbit_type = "MEO";
  else if (/\bheo\b|highly elliptical/i.test(text)) orbit_type = "HEO";
  else if (/\bleo\b|low earth/i.test(text)) orbit_type = "LEO";

  // altitude
  const altMatch =
    text.match(/(\d+(?:\.\d+)?)\s*km/i) ||
    text.match(/altitude[^\d]*(\d+(?:\.\d+)?)/i);
  const target_altitude_km = altMatch ? parseFloat(altMatch[1]) : null;

  // budget
  let budget_usd: number | null = null;
  const budgetMatch =
    text.match(/\$(\d+(?:\.\d+)?)\s*([Mm]illion|[Mm]|[Bb]illion|[Bb])?/i) ||
    text.match(/budget[^\d]*(\d+(?:\.\d+)?)\s*([Mm]illion|[Mm]|[Bb]illion|[Bb])?/i);
  if (budgetMatch) {
    let val = parseFloat(budgetMatch[1]);
    const unit = (budgetMatch[2] ?? "").toLowerCase();
    if (unit.startsWith("b")) val *= 1_000_000_000;
    else if (unit.startsWith("m")) val *= 1_000_000;
    budget_usd = val;
  }

  // schedule
  const scheduleMatch =
    text.match(/(\d+)\s*months?/i) ||
    text.match(/launch.{0,20}(\d+)\s*months?/i);
  const schedule_months = scheduleMatch ? parseInt(scheduleMatch[1], 10) : null;

  // inclination flexibility
  let inclination_flexibility_required: ParsedMission["inclination_flexibility_required"] =
    null;
  if (/custom|specific inclination|exact inclination|customer.defined/i.test(lower))
    inclination_flexibility_required = "customer-defined";
  else if (/any inclination|flexible/i.test(lower))
    inclination_flexibility_required = "any";
  else if (/fixed inclination|fixed orbit/i.test(lower))
    inclination_flexibility_required = "fixed";

  const found = [payload_mass_kg, orbit_type, budget_usd, schedule_months].filter(
    (v) => v !== null
  ).length;

  return {
    payload_mass_kg,
    orbit_type,
    target_altitude_km,
    budget_usd,
    schedule_months,
    inclination_flexibility_required,
    raw_input: text,
    parse_confidence: found >= 3 ? "medium" : "low",
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function parseMissionDescription(
  text: string
): Promise<ParsedMission> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return heuristicParse(text);
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents: text,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const parsed = ParsedMissionSchema.parse(JSON.parse(raw));

    return { ...parsed, raw_input: text };
  } catch {
    // Any error (network, parse, validation) → fall back to heuristic
    const fallback = heuristicParse(text);
    return { ...fallback, parse_confidence: "low" };
  }
}
