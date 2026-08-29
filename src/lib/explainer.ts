import type { RankedVehicle, ParsedMission, PriorityWeights, ExplainResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Build a compact context string for the LLM
// ---------------------------------------------------------------------------
function buildContext(
  ranked: RankedVehicle[],
  mission: ParsedMission,
  weights: PriorityWeights
): string {
  const fmtUsd = (v: number | null) =>
    v !== null ? `$${v.toLocaleString()}` : "unknown";

  const missionSummary = [
    mission.payload_mass_kg != null && `payload: ${mission.payload_mass_kg} kg`,
    mission.orbit_type && `orbit: ${mission.orbit_type}`,
    mission.target_altitude_km != null && `altitude: ${mission.target_altitude_km} km`,
    mission.budget_usd != null && `budget: ${fmtUsd(mission.budget_usd)}`,
    mission.schedule_months != null && `max lead time: ${mission.schedule_months} months`,
    mission.inclination_flexibility_required &&
      `inclination flexibility required: ${mission.inclination_flexibility_required}`,
  ]
    .filter(Boolean)
    .join(", ");

  const priorityStr = `cost priority: ${weights.cost}, schedule priority: ${weights.schedule}, orbit precision priority: ${weights.orbit_precision}`;

  const vehicleSummaries = ranked
    .slice(0, 5) // cap at top 5 to keep context concise
    .map(
      (v) =>
        `#${v.rank} ${v.entry.vehicle} (${v.entry.provider}) — score: ${v.score}, ` +
        `est. cost: ${fmtUsd(v.estimated_cost_usd)}, ` +
        `lead time: ${v.entry.integration.lead_time_months.min}–${v.entry.integration.lead_time_months.max} months, ` +
        `orbit flexibility: ${v.entry.orbit_options.inclination_flexibility}, ` +
        `supported orbits: ${v.entry.orbit_options.supported_orbit_types.join("/")}` +
        (v.entry.notes ? `, notes: ${v.entry.notes.slice(0, 200)}` : "")
    )
    .join("\n");

  return `MISSION: ${missionSummary || "not specified"}
USER PRIORITIES: ${priorityStr}
VIABLE VEHICLES (ranked best → worst):
${vehicleSummaries}`;
}

const SYSTEM_PROMPT = `You are an expert spacecraft mission architect advising a satellite operator on launch vehicle selection.

Given a mission summary and a ranked list of launch vehicles, write a concise plain-language recommendation (3–5 paragraphs) that:
1. States the top recommendation clearly in the first sentence and why it best fits the mission.
2. Explains the key trade-offs between the top 2–3 options, referencing concrete numbers (cost, lead time, orbit flexibility).
3. Notes any important caveats or risks for the recommended option.
4. If the user's priorities (cost / schedule / orbit precision weights) are uneven, acknowledge how those priorities drove the ranking.

Tone: direct, technical but accessible — like advice from a senior engineer to a programme manager.
Format: plain prose paragraphs only, no bullet lists, no markdown headers. Keep total length under 350 words.`;

// ---------------------------------------------------------------------------
// Fallback template when Gemini is unavailable
// ---------------------------------------------------------------------------
function buildFallback(ranked: RankedVehicle[], mission: ParsedMission): string {
  if (ranked.length === 0) {
    return "No viable launch options remain after applying your mission constraints. Consider relaxing the budget ceiling, extending the schedule, or revisiting the orbit requirements.";
  }

  const top = ranked[0];
  const fmtUsd = (v: number | null) =>
    v !== null ? `$${v.toLocaleString()}` : "unknown";

  let text =
    `Based on your mission requirements, **${top.entry.vehicle}** (${top.entry.provider}) is the top-ranked option ` +
    `with an estimated launch cost of ${fmtUsd(top.estimated_cost_usd)} and an integration lead time of ` +
    `${top.entry.integration.lead_time_months.min}–${top.entry.integration.lead_time_months.max} months. ` +
    `It supports ${top.entry.orbit_options.supported_orbit_types.join("/")} orbits with ` +
    `${top.entry.orbit_options.inclination_flexibility} inclination flexibility.`;

  if (ranked.length > 1) {
    const second = ranked[1];
    text +=
      ` The second-ranked option, **${second.entry.vehicle}** (${second.entry.provider}), offers ` +
      `${second.entry.orbit_options.inclination_flexibility} inclination flexibility at an estimated cost of ` +
      `${fmtUsd(second.estimated_cost_usd)}.`;
  }

  if (mission.budget_usd != null) {
    text += ` Your stated budget of ${fmtUsd(mission.budget_usd)} has been used as a hard constraint — all listed options fall within it.`;
  }

  text +=
    " *(AI explanation unavailable — set GEMINI_API_KEY for a detailed trade-off analysis.)*";
  return text;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function explainRecommendation(
  ranked: RankedVehicle[],
  mission: ParsedMission,
  weights: PriorityWeights,
  model = "gemini-3.6-flash"
): Promise<ExplainResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { explanation: buildFallback(ranked, mission), fallback: true };
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });

    const context = buildContext(ranked, mission, weights);

    const response = await client.models.generateContent({
      model,
      contents: context,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.4,
        maxOutputTokens: 600,
      },
    });

    const explanation = response.text?.trim();
    if (!explanation) {
      // Empty/blank completion is as unusable as a thrown error — say so.
      return { explanation: buildFallback(ranked, mission), fallback: true };
    }
    return { explanation, fallback: false };
  } catch {
    return { explanation: buildFallback(ranked, mission), fallback: true };
  }
}
