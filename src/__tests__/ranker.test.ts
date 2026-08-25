import { rankVehicles, estimateCost } from "@/lib/ranker";
import type {
  LaunchVehicleEntry,
  MatchedVehicle,
  ParsedMission,
  PriorityWeights,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeEntry(overrides: Partial<LaunchVehicleEntry> = {}): LaunchVehicleEntry {
  return {
    id: "test-vehicle",
    provider: "Test Corp",
    vehicle: "TestRocket",
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

function viable(entry: LaunchVehicleEntry): MatchedVehicle {
  return {
    entry,
    passes_mass: true,
    passes_orbit: true,
    passes_budget: true,
    passes_schedule: true,
    eliminated: false,
    elimination_reason: null,
  };
}

function eliminated(entry: LaunchVehicleEntry): MatchedVehicle {
  return {
    entry,
    passes_mass: false,
    passes_orbit: true,
    passes_budget: true,
    passes_schedule: true,
    eliminated: true,
    elimination_reason: "Too heavy.",
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

const equalWeights: PriorityWeights = { cost: 1, schedule: 1, orbit_precision: 1 };

// ---------------------------------------------------------------------------
// estimateCost
// ---------------------------------------------------------------------------
describe("estimateCost", () => {
  it("per-kg model: cost = per_kg_usd × mass", () => {
    const entry = makeEntry({
      cost: { model: "per-kg", base_usd: null, per_kg_usd: 6000, typical_total_usd: null, notes: "" },
    });
    expect(estimateCost(entry, 100)).toBe(600_000);
  });

  it("per-kg model: falls back to typical_total_usd when mass is null", () => {
    const entry = makeEntry({
      cost: { model: "per-kg", base_usd: null, per_kg_usd: 6000, typical_total_usd: 300_000, notes: "" },
    });
    expect(estimateCost(entry, null)).toBe(300_000);
  });

  it("flat-per-launch model: returns base_usd", () => {
    expect(estimateCost(makeEntry(), 200)).toBe(8_000_000);
  });

  it("flat-per-launch model: falls back to typical_total_usd when base_usd is null", () => {
    const entry = makeEntry({
      cost: { model: "flat-per-launch", base_usd: null, per_kg_usd: null, typical_total_usd: 9_000_000, notes: "" },
    });
    expect(estimateCost(entry, 50)).toBe(9_000_000);
  });

  it("base-plus-per-kg model: returns base + per_kg × mass", () => {
    const entry = makeEntry({
      cost: { model: "base-plus-per-kg", base_usd: 5_000_000, per_kg_usd: 3_000, typical_total_usd: null, notes: "" },
    });
    expect(estimateCost(entry, 100)).toBe(5_300_000);
  });

  it("base-plus-per-kg model: falls back to typical_total_usd when mass is null", () => {
    const entry = makeEntry({
      cost: { model: "base-plus-per-kg", base_usd: 5_000_000, per_kg_usd: 3_000, typical_total_usd: 6_000_000, notes: "" },
    });
    expect(estimateCost(entry, null)).toBe(6_000_000);
  });

  it("returns null when model is unrecognised", () => {
    const entry = makeEntry({
      cost: { model: "per-kg", base_usd: null, per_kg_usd: null, typical_total_usd: null, notes: "" },
    });
    // per_kg_usd is null and mass is null → falls through to typical_total_usd which is also null
    expect(estimateCost(entry, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// rankVehicles — empty input
// ---------------------------------------------------------------------------
describe("rankVehicles — empty viable list", () => {
  it("returns empty ranked array and passes through eliminated list", () => {
    const e = eliminated(makeEntry());
    const result = rankVehicles([e], defaultMission, equalWeights);
    expect(result.ranked).toHaveLength(0);
    expect(result.eliminated).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// rankVehicles — single vehicle
// ---------------------------------------------------------------------------
describe("rankVehicles — single viable vehicle", () => {
  it("assigns rank 1 and scores 0–100", () => {
    const [result] = rankVehicles([viable(makeEntry())], defaultMission, equalWeights).ranked;
    expect(result.rank).toBe(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("attaches estimated_cost_usd from the entry", () => {
    const [result] = rankVehicles([viable(makeEntry())], defaultMission, equalWeights).ranked;
    expect(result.estimated_cost_usd).toBe(8_000_000);
  });
});

// ---------------------------------------------------------------------------
// rankVehicles — ranking order
// ---------------------------------------------------------------------------
describe("rankVehicles — ordering", () => {
  it("ranks lower-cost vehicle first when cost weight dominates", () => {
    const cheap = makeEntry({
      id: "cheap",
      cost: { model: "flat-per-launch", base_usd: 1_000_000, per_kg_usd: null, typical_total_usd: 1_000_000, notes: "" },
      integration: { ...makeEntry().integration, lead_time_months: { min: 12, max: 18 } },
    });
    const expensive = makeEntry({
      id: "expensive",
      cost: { model: "flat-per-launch", base_usd: 20_000_000, per_kg_usd: null, typical_total_usd: 20_000_000, notes: "" },
    });

    const { ranked } = rankVehicles(
      [viable(expensive), viable(cheap)],
      defaultMission,
      { cost: 10, schedule: 0, orbit_precision: 0 }
    );

    expect(ranked[0].entry.id).toBe("cheap");
    expect(ranked[1].entry.id).toBe("expensive");
  });

  it("ranks faster vehicle first when schedule weight dominates", () => {
    const fast = makeEntry({
      id: "fast",
      integration: { ...makeEntry().integration, lead_time_months: { min: 3, max: 6 } },
    });
    const slow = makeEntry({
      id: "slow",
      integration: { ...makeEntry().integration, lead_time_months: { min: 18, max: 24 } },
    });

    const { ranked } = rankVehicles(
      [viable(slow), viable(fast)],
      defaultMission,
      { cost: 0, schedule: 10, orbit_precision: 0 }
    );

    expect(ranked[0].entry.id).toBe("fast");
    expect(ranked[1].entry.id).toBe("slow");
  });

  it("ranks customer-defined flexibility first when orbit_precision weight dominates", () => {
    const flexible = makeEntry({
      id: "flexible",
      orbit_options: { ...makeEntry().orbit_options, inclination_flexibility: "customer-defined" },
    });
    const fixed = makeEntry({
      id: "fixed",
      orbit_options: { ...makeEntry().orbit_options, inclination_flexibility: "fixed" },
    });

    const { ranked } = rankVehicles(
      [viable(fixed), viable(flexible)],
      defaultMission,
      { cost: 0, schedule: 0, orbit_precision: 10 }
    );

    expect(ranked[0].entry.id).toBe("flexible");
  });

  it("assigns consecutive 1-based ranks", () => {
    const entries = [makeEntry({ id: "a" }), makeEntry({ id: "b" }), makeEntry({ id: "c" })];
    const { ranked } = rankVehicles(entries.map(viable), defaultMission, equalWeights);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// rankVehicles — zero weights fallback
// ---------------------------------------------------------------------------
describe("rankVehicles — zero weights", () => {
  it("does not throw when all weights are 0 (falls back to equal weighting)", () => {
    const entries = [makeEntry({ id: "x" }), makeEntry({ id: "y" })];
    expect(() =>
      rankVehicles(entries.map(viable), defaultMission, { cost: 0, schedule: 0, orbit_precision: 0 })
    ).not.toThrow();
  });
});
