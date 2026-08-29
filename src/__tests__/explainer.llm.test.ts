/**
 * Tests for the LLM explanation path (GEMINI_API_KEY set).
 *
 * The SDK is replaced by the manual mock in `__mocks__/@google/genai.ts`, so
 * these assert on the context the explainer builds and on how it degrades —
 * not on prose quality.
 */
import { explainRecommendation } from "@/lib/explainer";
import type {
  LaunchVehicleEntry,
  MatchedVehicle,
  ParsedMission,
  PriorityWeights,
  RankedVehicle,
} from "@/lib/types";
import {
  __lastRequest,
  __queueError,
  __queueText,
  __requestCount,
  __reset,
} from "./helpers/genaiMock";

beforeEach(() => {
  __reset();
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeEntry(
  id: string,
  vehicle: string,
  provider: string,
  overrides: Partial<LaunchVehicleEntry> = {}
): LaunchVehicleEntry {
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
    ...overrides,
  };
}

function makeRanked(entry: LaunchVehicleEntry, rank: number): RankedVehicle {
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
    score: 90 - rank * 5,
    score_breakdown: { cost_score: 80, schedule_score: 80, orbit_score: 80 },
    estimated_cost_usd: 8_000_000,
  };
}

const mission: ParsedMission = {
  payload_mass_kg: 100,
  orbit_type: "LEO",
  target_altitude_km: 500,
  budget_usd: 12_000_000,
  schedule_months: 18,
  inclination_flexibility_required: "customer-defined",
  raw_input: "100 kg LEO",
  parse_confidence: "high",
};

const weights: PriorityWeights = { cost: 3, schedule: 1, orbit_precision: 2 };

const oneVehicle = () => [makeRanked(makeEntry("r1", "Electron", "Rocket Lab"), 1)];

// ---------------------------------------------------------------------------
// Context building
// ---------------------------------------------------------------------------
describe("explainRecommendation — context sent to Gemini", () => {
  it("summarises every stated mission constraint", async () => {
    __queueText("Recommendation prose.");

    await explainRecommendation(oneVehicle(), mission, weights);

    const contents = __lastRequest()?.contents ?? "";
    expect(contents).toContain("payload: 100 kg");
    expect(contents).toContain("orbit: LEO");
    expect(contents).toContain("altitude: 500 km");
    expect(contents).toContain("budget: $12,000,000");
    expect(contents).toContain("max lead time: 18 months");
    expect(contents).toContain("inclination flexibility required: customer-defined");
  });

  it("omits unstated constraints rather than sending nulls", async () => {
    __queueText("Recommendation prose.");

    const sparse: ParsedMission = {
      ...mission,
      budget_usd: null,
      schedule_months: null,
      target_altitude_km: null,
      inclination_flexibility_required: null,
    };
    await explainRecommendation(oneVehicle(), sparse, weights);

    const contents = __lastRequest()?.contents ?? "";
    expect(contents).not.toContain("null");
    expect(contents).not.toContain("budget:");
    expect(contents).toContain("payload: 100 kg");
  });

  it("passes the user's priority weights through", async () => {
    __queueText("Recommendation prose.");

    await explainRecommendation(oneVehicle(), mission, weights);

    expect(__lastRequest()?.contents).toContain(
      "cost priority: 3, schedule priority: 1, orbit precision priority: 2"
    );
  });

  it("caps the vehicle list at the top 5 to keep the prompt small", async () => {
    __queueText("Recommendation prose.");

    const ranked = Array.from({ length: 8 }, (_, i) =>
      makeRanked(makeEntry(`r${i + 1}`, `Vehicle${i + 1}`, "Provider"), i + 1)
    );
    await explainRecommendation(ranked, mission, weights);

    const contents = __lastRequest()?.contents ?? "";
    expect(contents).toContain("Vehicle5");
    expect(contents).not.toContain("Vehicle6");
  });

  it("truncates long vehicle notes", async () => {
    __queueText("Recommendation prose.");

    const wordy = makeEntry("r1", "Electron", "Rocket Lab", { notes: "x".repeat(500) });
    await explainRecommendation([makeRanked(wordy, 1)], mission, weights);

    expect(__lastRequest()?.contents).toContain("x".repeat(200));
    expect(__lastRequest()?.contents).not.toContain("x".repeat(201));
  });

  it("never calls the model when no API key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    await explainRecommendation(oneVehicle(), mission, weights);
    expect(__requestCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Response handling
// ---------------------------------------------------------------------------
describe("explainRecommendation — response handling", () => {
  it("returns the model's prose trimmed, with fallback: false", async () => {
    __queueText("\n  Electron is the strongest fit for this mission.  \n");

    const result = await explainRecommendation(oneVehicle(), mission, weights);

    expect(result.explanation).toBe("Electron is the strongest fit for this mission.");
    expect(result.fallback).toBe(false);
  });

  it("falls back to the template when the SDK throws", async () => {
    __queueError("500 Internal Server Error");

    const result = await explainRecommendation(oneVehicle(), mission, weights);

    expect(result.fallback).toBe(true);
    expect(result.explanation).toMatch(/Electron/);
  });

  it("falls back to the template when the model returns nothing", async () => {
    __queueText(undefined);

    const result = await explainRecommendation(oneVehicle(), mission, weights);

    expect(result.fallback).toBe(true);
    expect(result.explanation).toMatch(/Electron/);
  });

  it("falls back to the template when the model returns only whitespace", async () => {
    __queueText("   \n  ");

    const result = await explainRecommendation(oneVehicle(), mission, weights);

    expect(result.fallback).toBe(true);
    expect(result.explanation).toMatch(/Electron/);
  });

  it("falls back to the no-options template when nothing is viable", async () => {
    __queueError("network down");

    const result = await explainRecommendation([], mission, weights);

    expect(result.fallback).toBe(true);
    expect(result.explanation).toMatch(/no viable launch options/i);
  });
});
