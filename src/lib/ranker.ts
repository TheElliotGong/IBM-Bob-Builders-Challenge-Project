import type {
  MatchedVehicle,
  PriorityWeights,
  RankedVehicle,
  ParsedMission,
  LaunchVehicleEntry,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Cost estimation (mirrors filter.ts — kept here to avoid cross-importing)
// ---------------------------------------------------------------------------
export function estimateCost(
  entry: LaunchVehicleEntry,
  payload_mass_kg: number | null
): number | null {
  const { model, base_usd, per_kg_usd, typical_total_usd } = entry.cost;

  if (model === "per-kg") {
    if (per_kg_usd !== null && payload_mass_kg !== null)
      return per_kg_usd * payload_mass_kg;
    return typical_total_usd;
  }
  if (model === "flat-per-launch") {
    return base_usd ?? typical_total_usd;
  }
  if (model === "base-plus-per-kg") {
    if (base_usd !== null && per_kg_usd !== null && payload_mass_kg !== null)
      return base_usd + per_kg_usd * payload_mass_kg;
    return typical_total_usd ?? base_usd;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Orbit precision score  (0 = fixed, 50 = limited, 100 = customer-defined)
// ---------------------------------------------------------------------------
const ORBIT_FLEXIBILITY_SCORE: Record<string, number> = {
  fixed: 0,
  limited: 50,
  "customer-defined": 100,
  any: 100,
};

// ---------------------------------------------------------------------------
// Min-max normalise an array of numbers to 0–100.
// When all values are identical every entry scores 50 (no differentiation).
// ---------------------------------------------------------------------------
function normalise(values: (number | null)[], invert = false): number[] {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return values.map(() => 50);

  const min = Math.min(...valid);
  const max = Math.max(...valid);

  return values.map((v) => {
    if (v === null) return 50; // unknown → neutral
    if (max === min) return 50; // all identical → neutral
    const norm = ((v - min) / (max - min)) * 100;
    return invert ? 100 - norm : norm;
  });
}

// ---------------------------------------------------------------------------
// Main ranker
// ---------------------------------------------------------------------------
export function rankVehicles(
  matches: MatchedVehicle[],
  mission: ParsedMission,
  weights: PriorityWeights
): { ranked: RankedVehicle[]; eliminated: MatchedVehicle[] } {
  const viable = matches.filter((m) => !m.eliminated);
  const eliminated = matches.filter((m) => m.eliminated);

  if (viable.length === 0) return { ranked: [], eliminated };

  // --- Raw scores per dimension ---
  const costs = viable.map((m) =>
    estimateCost(m.entry, mission.payload_mass_kg)
  );
  const leadTimes = viable.map(
    (m) => m.entry.integration.lead_time_months.min
  );
  const orbitScores = viable.map(
    (m) => ORBIT_FLEXIBILITY_SCORE[m.entry.orbit_options.inclination_flexibility] ?? 50
  );

  // Normalise: cost → invert (lower is better), schedule → invert (shorter is better),
  // orbit precision → higher is better
  const normCost = normalise(costs, true);
  const normSchedule = normalise(leadTimes, true);
  const normOrbit = normalise(orbitScores, false);

  // --- Weight normalisation (so weights don't need to sum to 1) ---
  const totalWeight = weights.cost + weights.schedule + weights.orbit_precision;
  const w =
    totalWeight === 0
      ? { cost: 1 / 3, schedule: 1 / 3, orbit: 1 / 3 }
      : {
          cost: weights.cost / totalWeight,
          schedule: weights.schedule / totalWeight,
          orbit: weights.orbit_precision / totalWeight,
        };

  // --- Composite score ---
  const ranked: RankedVehicle[] = viable
    .map((m, i) => {
      const cost_score = normCost[i];
      const schedule_score = normSchedule[i];
      const orbit_score = normOrbit[i];
      const score =
        w.cost * cost_score + w.schedule * schedule_score + w.orbit * orbit_score;

      return {
        ...m,
        score: Math.round(score * 10) / 10,
        score_breakdown: {
          cost_score: Math.round(cost_score),
          schedule_score: Math.round(schedule_score),
          orbit_score: Math.round(orbit_score),
        },
        estimated_cost_usd: estimateCost(m.entry, mission.payload_mass_kg),
        rank: 0, // filled below
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((v, i) => ({ ...v, rank: i + 1 }));

  return { ranked, eliminated };
}
