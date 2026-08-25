import { filterCatalog } from "@/lib/filter";
import type { LaunchVehicleEntry, ParsedMission } from "@/lib/types";

// ---------------------------------------------------------------------------
// Minimal catalog fixture helpers
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

function makeMission(overrides: Partial<ParsedMission> = {}): ParsedMission {
  return {
    payload_mass_kg: null,
    orbit_type: null,
    target_altitude_km: null,
    budget_usd: null,
    schedule_months: null,
    inclination_flexibility_required: null,
    raw_input: "",
    parse_confidence: "high",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Retired vehicles
// ---------------------------------------------------------------------------
describe("filterCatalog — retired vehicles", () => {
  it("immediately eliminates a retired vehicle regardless of constraints", () => {
    const catalog = [makeEntry({ status: "retired" })];
    const mission = makeMission();
    const [result] = filterCatalog(mission, catalog);
    expect(result.eliminated).toBe(true);
    expect(result.elimination_reason).toMatch(/retired/i);
    expect(result.passes_mass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mass check
// ---------------------------------------------------------------------------
describe("filterCatalog — mass constraint", () => {
  it("passes when payload mass is within capacity", () => {
    const catalog = [makeEntry({ capacity: { ...makeEntry().capacity, max_kg: 300 } })];
    const [result] = filterCatalog(makeMission({ payload_mass_kg: 200 }), catalog);
    expect(result.passes_mass).toBe(true);
    expect(result.eliminated).toBe(false);
  });

  it("eliminates when payload mass exceeds capacity", () => {
    const catalog = [makeEntry({ capacity: { ...makeEntry().capacity, max_kg: 100 } })];
    const [result] = filterCatalog(makeMission({ payload_mass_kg: 150 }), catalog);
    expect(result.passes_mass).toBe(false);
    expect(result.eliminated).toBe(true);
    expect(result.elimination_reason).toMatch(/150 kg exceeds vehicle max capacity 100 kg/);
  });

  it("passes when payload_mass_kg is null (unconstrained)", () => {
    const [result] = filterCatalog(makeMission({ payload_mass_kg: null }), [makeEntry()]);
    expect(result.passes_mass).toBe(true);
  });

  it("passes when payload exactly equals max_kg", () => {
    const catalog = [makeEntry({ capacity: { ...makeEntry().capacity, max_kg: 300 } })];
    const [result] = filterCatalog(makeMission({ payload_mass_kg: 300 }), catalog);
    expect(result.passes_mass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Orbit check
// ---------------------------------------------------------------------------
describe("filterCatalog — orbit constraint", () => {
  it("passes when orbit type is supported", () => {
    const [result] = filterCatalog(makeMission({ orbit_type: "LEO" }), [makeEntry()]);
    expect(result.passes_orbit).toBe(true);
  });

  it("eliminates when orbit type is not supported", () => {
    const [result] = filterCatalog(makeMission({ orbit_type: "GTO" }), [makeEntry()]);
    expect(result.passes_orbit).toBe(false);
    expect(result.eliminated).toBe(true);
    expect(result.elimination_reason).toMatch(/GTO not in supported types/);
  });

  it("passes when orbit_type is null", () => {
    const [result] = filterCatalog(makeMission({ orbit_type: null }), [makeEntry()]);
    expect(result.passes_orbit).toBe(true);
  });

  it('passes when orbit_type is "any"', () => {
    const [result] = filterCatalog(makeMission({ orbit_type: "any" }), [makeEntry()]);
    expect(result.passes_orbit).toBe(true);
  });

  it("does a case-insensitive supported orbit check", () => {
    const entry = makeEntry({
      orbit_options: {
        ...makeEntry().orbit_options,
        supported_orbit_types: ["sso", "leo"],
      },
    });
    const [result] = filterCatalog(makeMission({ orbit_type: "SSO" }), [entry]);
    expect(result.passes_orbit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Budget check — per-kg model
// ---------------------------------------------------------------------------
describe("filterCatalog — budget constraint (per-kg)", () => {
  const perKgEntry = makeEntry({
    cost: {
      model: "per-kg",
      base_usd: null,
      per_kg_usd: 6_000,
      typical_total_usd: null,
      notes: "",
    },
  });

  it("passes when estimated cost is within budget", () => {
    // 100 kg × $6k = $600k; budget $1M
    const [result] = filterCatalog(
      makeMission({ payload_mass_kg: 100, budget_usd: 1_000_000 }),
      [perKgEntry]
    );
    expect(result.passes_budget).toBe(true);
  });

  it("eliminates when estimated cost exceeds budget", () => {
    // 100 kg × $6k = $600k; budget $500k
    const [result] = filterCatalog(
      makeMission({ payload_mass_kg: 100, budget_usd: 500_000 }),
      [perKgEntry]
    );
    expect(result.passes_budget).toBe(false);
    expect(result.eliminated).toBe(true);
  });

  it("passes when budget_usd is null", () => {
    const [result] = filterCatalog(
      makeMission({ payload_mass_kg: 100, budget_usd: null }),
      [perKgEntry]
    );
    expect(result.passes_budget).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Budget check — flat-per-launch model
// ---------------------------------------------------------------------------
describe("filterCatalog — budget constraint (flat-per-launch)", () => {
  it("uses base_usd for flat pricing", () => {
    // base $8M; budget $10M → passes
    const [passingResult] = filterCatalog(
      makeMission({ budget_usd: 10_000_000 }),
      [makeEntry()]
    );
    expect(passingResult.passes_budget).toBe(true);

    // base $8M; budget $5M → eliminated
    const [failingResult] = filterCatalog(
      makeMission({ budget_usd: 5_000_000 }),
      [makeEntry()]
    );
    expect(failingResult.passes_budget).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schedule check
// ---------------------------------------------------------------------------
describe("filterCatalog — schedule constraint", () => {
  it("passes when min lead time is within schedule", () => {
    // min lead time 6 months; schedule 12 months → passes
    const [result] = filterCatalog(makeMission({ schedule_months: 12 }), [makeEntry()]);
    expect(result.passes_schedule).toBe(true);
  });

  it("eliminates when min lead time exceeds required schedule", () => {
    // min lead time 6 months; schedule 4 months → eliminated
    const [result] = filterCatalog(makeMission({ schedule_months: 4 }), [makeEntry()]);
    expect(result.passes_schedule).toBe(false);
    expect(result.eliminated).toBe(true);
    expect(result.elimination_reason).toMatch(/Minimum lead time 6 months exceeds required schedule 4 months/);
  });

  it("passes when schedule_months is null", () => {
    const [result] = filterCatalog(makeMission({ schedule_months: null }), [makeEntry()]);
    expect(result.passes_schedule).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multiple vehicles
// ---------------------------------------------------------------------------
describe("filterCatalog — multiple vehicles", () => {
  it("returns one result per catalog entry", () => {
    const catalog = [makeEntry({ id: "a" }), makeEntry({ id: "b" }), makeEntry({ id: "c" })];
    const results = filterCatalog(makeMission(), catalog);
    expect(results).toHaveLength(3);
  });

  it("accumulates multiple elimination reasons in one string", () => {
    const heavyMission = makeMission({
      payload_mass_kg: 9999,  // exceeds capacity
      orbit_type: "GTO",      // unsupported
    });
    const [result] = filterCatalog(heavyMission, [makeEntry()]);
    expect(result.eliminated).toBe(true);
    expect(result.elimination_reason).toContain("kg exceeds");
    expect(result.elimination_reason).toContain("GTO not in supported types");
  });
});
