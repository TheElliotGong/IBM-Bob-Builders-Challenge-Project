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
Infer field values from natural language — do not require exact keywords.

Fields to extract:
- payload_mass_kg: numeric kg of the payload (null if not specified; convert lbs or tonnes to kg if needed)
- orbit_type: one of "LEO", "SSO", "MEO", "GTO", "GEO", "HEO", "any" (null if unclear; infer from context, e.g. "low earth orbit" → "LEO", "800km MEO orbit" → "MEO")
- target_altitude_km: numeric km if an altitude is mentioned (null otherwise; convert miles to km if needed)
- budget_usd: maximum budget in USD as a number (null if not specified; convert M/million/billion to full number; "$15 million" → 15000000)
- schedule_months: maximum acceptable months from contract to launch (null if not specified; convert years to months: "2 years" → 24, "within a year" → 12)
- inclination_flexibility_required: one of "fixed", "limited", "customer-defined", "any" (null if unspecified; "flexible" → "any", "inclination control is flexible" → "any", "specific inclination" → "customer-defined")
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
//
// This is a safety net, not the primary parser: it only runs when the LLM above
// is unavailable or returns something unusable. It covers the common phrasings
// and unit conversions; genuinely freeform input is the model's job.
// ---------------------------------------------------------------------------
const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const WORD_NUM_ALT =
  "a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";

// Plain or comma-grouped number, e.g. "42.5" or "10,000,000"
const NUM = "\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?";

function toNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

// Round conversions to 1dp so "220 lbs" reads as 99.8, not 99.79024
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// --- mass ------------------------------------------------------------------
const MASS_PATTERNS: Array<{ re: RegExp; factor: number }> = [
  { re: new RegExp(`(${NUM})\\s*(?:kg|kilograms?|kilos?)\\b`, "i"), factor: 1 },
  { re: new RegExp(`(${NUM})\\s*(?:tonnes?|tons?|t)\\b`, "i"), factor: 1000 },
  { re: new RegExp(`(${NUM})\\s*(?:lbs?|pounds?)\\b`, "i"), factor: 0.453592 },
  { re: new RegExp(`mass[^\\d]{0,20}(${NUM})`, "i"), factor: 1 },
];

function parseMass(text: string): number | null {
  for (const { re, factor } of MASS_PATTERNS) {
    const match = text.match(re);
    if (match) return round1(toNumber(match[1]) * factor);
  }
  return null;
}

// --- orbit -----------------------------------------------------------------
function parseOrbit(text: string): ParsedMission["orbit_type"] {
  // GTO must be tested before GEO — "geostationary transfer orbit" is a GTO.
  if (/\bsso\b|sun[\s-]?sync(?:hronous)?|polar\s+sun/i.test(text)) return "SSO";
  if (/\bgto\b|geo(?:stationary|synchronous)\s+transfer/i.test(text)) return "GTO";
  if (/\bgeo\b|geostationary|geosynchronous/i.test(text)) return "GEO";
  if (/\bmeo\b|medium[\s-]?earth/i.test(text)) return "MEO";
  if (/\bheo\b|highly[\s-]?elliptical/i.test(text)) return "HEO";
  if (/\bleo\b|low[\s-]?earth/i.test(text)) return "LEO";
  return null;
}

// --- altitude --------------------------------------------------------------
function parseAltitude(text: string): number | null {
  const km = text.match(new RegExp(`(${NUM})\\s*(?:km|kilometres?|kilometers?)\\b`, "i"));
  if (km) return round1(toNumber(km[1]));

  const miles = text.match(new RegExp(`(${NUM})\\s*(?:mi|miles?)\\b`, "i"));
  if (miles) return round1(toNumber(miles[1]) * 1.609344);

  const labelled = text.match(new RegExp(`altitude[^\\d]{0,20}(${NUM})`, "i"));
  return labelled ? round1(toNumber(labelled[1])) : null;
}

// --- budget ----------------------------------------------------------------
const MONEY_SCALE: Record<string, number> = {
  k: 1e3, thousand: 1e3,
  m: 1e6, mil: 1e6, million: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9,
};
// Longest alternatives first so "million" is not consumed as "m".
const MONEY_UNIT = "thousand|million|billion|mil|bn|k|m|b";
// Units that can only mean a money scale here — safe to match without a "$"
// or "budget" cue ("5 mil"), unlike bare "m"/"k" which collide with km/kg.
const UNAMBIGUOUS_MONEY_UNIT = "thousand|million|billion|mil|bn";

function moneyScale(unit: string | undefined): number {
  return unit ? MONEY_SCALE[unit.toLowerCase()] ?? 1 : 1;
}

function parseBudget(text: string): number | null {
  const dollars = text.match(
    new RegExp(`\\$\\s*(${NUM})\\s*(${MONEY_UNIT})?\\b`, "i")
  );
  if (dollars) return toNumber(dollars[1]) * moneyScale(dollars[2]);

  const labelled = text.match(
    new RegExp(`budget[^\\d$]{0,20}\\$?\\s*(${NUM})\\s*(${MONEY_UNIT})?\\b`, "i")
  );
  if (labelled) return toNumber(labelled[1]) * moneyScale(labelled[2]);

  const scaled = text.match(
    new RegExp(`(${NUM})\\s*(${UNAMBIGUOUS_MONEY_UNIT})\\b`, "i")
  );
  if (scaled) return toNumber(scaled[1]) * moneyScale(scaled[2]);

  // "two million dollars", "two and a half million"
  const worded = text.match(
    new RegExp(
      `\\b(${WORD_NUM_ALT})\\s+(and\\s+a\\s+half\\s+)?(${UNAMBIGUOUS_MONEY_UNIT})\\b`,
      "i"
    )
  );
  if (worded) {
    const base = (WORD_NUM[worded[1].toLowerCase()] ?? 1) + (worded[2] ? 0.5 : 0);
    return base * moneyScale(worded[3]);
  }

  return null;
}

// --- schedule (always normalised to months) --------------------------------
function parseSchedule(text: string): number | null {
  if (/\b(?:a|one)\s+year\s+and\s+a\s+half\b|\byear\s+and\s+a\s+half\b/i.test(text))
    return 18;
  if (/\bhalf\s+a\s+year\b/i.test(text)) return 6;

  // "18 months" / "18-month" / "18 – month"
  const months = text.match(new RegExp(`(${NUM})\\s*[-–—]?\\s*months?\\b`, "i"));
  if (months) return Math.round(toNumber(months[1]));

  const years = text.match(new RegExp(`(${NUM})\\s*[-–—]?\\s*(?:years?|yrs?)\\b`, "i"));
  if (years) return Math.round(toNumber(years[1]) * 12);

  if (/\b(?:a\s+)?couple\s+(?:of\s+)?years?\b/i.test(text)) return 24;
  if (/\b(?:a\s+)?couple\s+(?:of\s+)?months?\b/i.test(text)) return 2;

  const wordYears = text.match(
    new RegExp(`\\b(${WORD_NUM_ALT})\\s*[-–—]?\\s*years?\\b`, "i")
  );
  if (wordYears) return (WORD_NUM[wordYears[1].toLowerCase()] ?? 1) * 12;

  const wordMonths = text.match(
    new RegExp(`\\b(${WORD_NUM_ALT})\\s*[-–—]?\\s*months?\\b`, "i")
  );
  if (wordMonths) return WORD_NUM[wordMonths[1].toLowerCase()] ?? null;

  return null;
}

// --- inclination flexibility -----------------------------------------------
function parseInclination(
  text: string
): ParsedMission["inclination_flexibility_required"] {
  if (/custom|specific inclination|exact inclination|customer.?defined/i.test(text))
    return "customer-defined";
  if (
    /any inclination|flexible|inclination.{0,20}flexible|flexible.{0,20}inclination|(?:don'?t|doesn'?t|do not)\s+care\s+about\s+(?:the\s+)?inclination|no preference/i.test(
      text
    )
  )
    return "any";
  if (/fixed inclination|fixed orbit|inclination.{0,20}fixed/i.test(text))
    return "fixed";
  if (/limited inclination|inclination.{0,20}limited/i.test(text)) return "limited";
  return null;
}

function heuristicParse(text: string): ParsedMission {
  const payload_mass_kg = parseMass(text);
  const orbit_type = parseOrbit(text);
  const target_altitude_km = parseAltitude(text);
  const budget_usd = parseBudget(text);
  const schedule_months = parseSchedule(text);
  const inclination_flexibility_required = parseInclination(text);

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
  text: string,
  model = "gemini-3.6-flash"
): Promise<ParsedMission> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return heuristicParse(text);
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
      model,
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
