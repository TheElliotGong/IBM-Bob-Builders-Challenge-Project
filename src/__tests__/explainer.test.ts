/**
 * Tests for the fallback explanation path (no GEMINI_API_KEY set).
 */
import { explainRecommendation } from "@/lib/explainer";
import type {
  RankedVehicle,
  ParsedMission,
  PriorityWeights,
  LaunchVehicleEntry,
  MatchedVehicle,
} from "@/lib/types";

beforeAll(() => {
  delete process.env.GEMINI_API_KEY;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeEntry(id: string, vehicle: string, provider: string): LaunchVehicleEntry {
  return {
    id,
    provider,
    vehicle,
    type: "dedicated-small",
    capacity: {
      max_kg: 300,
      to_LEO_kg: 300,
      to_SSO_kg: 200,
      to_GTO_kg: null,
      reference_altitude_km: 500,
      min_kg: null,
    },
    cost: {
      model: "flat-per-launch",
      base_usd: 8_000_000,
      per_kg_usd: null,
      typical_total_usd: 8_000_000,
      notes: "",
    },
    orbit_options: {
      supported_orbit_types: ["LEO", "SSO"],
      inclination_flexibility: "customer-defined",
      altitude_range_km: { min: 200, max: 1200 },
    },
    integration: {
      lead_time_months: { min: 6, max: 12 },
      interface_standard: "ESPA",
      dispensers_provided: true,
    },
    cadence: {
      schedule_control: "customer",
      launches_per_year: 10,
      next_available_window: null,
    },
    status: "operational",
    data_sources: [],
    notes: "",
  };
}

function makeRanked(
  entry: LaunchVehicleEntry,
  rank: number,
  estimatedCost: number | null = 8_000_000
): RankedVehicle {
  const base: MatchedVehicle = {
    entry,
    passes_mass: true,
    passes_orbit: true,
    passes_budget: true,
    passes_schedule: true,
    eliminated: false,
    elimination_reason: null,
  };
  return {
    ...base,
    rank,
    score: 80 - rank * 5,
    score_breakdown: { cost_score: 80, schedule_score: 80, orbit_score: 80 },
    estimated_cost_usd: estimatedCost,
  };
}

const defaultMission: ParsedMission = {
  payload_mass_kg: 100,
  orbit_type: "LEO",
  target_altitude_km: 500,
  budget_usd: null,
  schedule_months: null,
  inclination_flexibility_required: null,
  raw_input: "100 kg LEO",
  parse_confidence: "high",
};

const defaultWeights: PriorityWeights = { cost: 1, schedule: 1, orbit_precision: 1 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("explainRecommendation — fallback (no API key)", () => {
  it("sets fallback: true", async () => {
    const ranked = [makeRanked(makeEntry("r1", "Electron", "Rocket Lab"), 1)];
    const { fallback } = await explainRecommendation(ranked, defaultMission, defaultWeights);
    expect(fallback).toBe(true);
  });

  it("mentions the top vehicle name in the explanation", async () => {
    const ranked = [makeRanked(makeEntry("r1", "Electron", "Rocket Lab"), 1)];
    const { explanation } = await explainRecommendation(ranked, defaultMission, defaultWeights);
    expect(explanation).toMatch(/Electron/);
  });

  it("mentions the provider in the explanation", async () => {
    const ranked = [makeRanked(makeEntry("r1", "Electron", "Rocket Lab"), 1)];
    const { explanation } = await explainRecommendation(ranked, defaultMission, defaultWeights);
    expect(explanation).toMatch(/Rocket Lab/);
  });

  it("includes the second-ranked vehicle when present", async () => {
    const ranked = [
      makeRanked(makeEntry("r1", "Electron", "Rocket Lab"), 1),
      makeRanked(makeEntry("r2", "Firefly Alpha", "Firefly Aerospace"), 2),
    ];
    const { explanation } = await explainRecommendation(ranked, defaultMission, defaultWeights);
    expect(explanation).toMatch(/Firefly Alpha/);
  });

  it("mentions the budget when it is set in the mission", async () => {
    const missionWithBudget: ParsedMission = { ...defaultMission, budget_usd: 10_000_000 };
    const ranked = [makeRanked(makeEntry("r1", "Electron", "Rocket Lab"), 1)];
    const { explanation } = await explainRecommendation(ranked, missionWithBudget, defaultWeights);
    expect(explanation).toMatch(/\$10,000,000|\$10M|budget/i);
  });

  it("handles an empty ranked list gracefully", async () => {
    const { explanation, fallback } = await explainRecommendation([], defaultMission, defaultWeights);
    expect(fallback).toBe(true);
    expect(explanation).toMatch(/no viable launch options/i);
  });

  it("formats estimated cost as '$X,XXX,XXX' or 'unknown'", async () => {
    const ranked = [makeRanked(makeEntry("r1", "Electron", "Rocket Lab"), 1, 8_000_000)];
    const { explanation } = await explainRecommendation(ranked, defaultMission, defaultWeights);
    expect(explanation).toMatch(/\$8,000,000/);
  });

  it("shows 'unknown' cost when estimated_cost_usd is null", async () => {
    const ranked = [makeRanked(makeEntry("r1", "Electron", "Rocket Lab"), 1, null)];
    const { explanation } = await explainRecommendation(ranked, defaultMission, defaultWeights);
    expect(explanation).toMatch(/unknown/i);
  });
});
