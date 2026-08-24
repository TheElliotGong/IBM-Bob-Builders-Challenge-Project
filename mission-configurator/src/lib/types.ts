// The raw shape of one catalog entry (mirrors catalog.schema.json)
export interface LaunchVehicleEntry {
  id: string;
  provider: string;
  vehicle: string;
  type: "rideshare" | "dedicated-small" | "dedicated-medium" | "dedicated-heavy";
  capacity: {
    max_kg: number;
    to_LEO_kg: number | null;
    to_SSO_kg: number | null;
    to_GTO_kg: number | null;
    reference_altitude_km: number | null;
    min_kg: number | null;
  };
  cost: {
    model: "per-kg" | "flat-per-launch" | "base-plus-per-kg";
    base_usd: number | null;
    per_kg_usd: number | null;
    typical_total_usd: number | null;
    notes: string;
  };
  orbit_options: {
    supported_orbit_types: string[];
    inclination_flexibility: "fixed" | "limited" | "customer-defined" | "any";
    altitude_range_km: { min: number; max: number };
  };
  integration: {
    lead_time_months: { min: number; max: number };
    interface_standard: string;
    dispensers_provided: boolean;
  };
  cadence: {
    schedule_control: "provider-fixed" | "customer" | "shared";
    launches_per_year: number;
    next_available_window: string | null;
  };
  status: "operational" | "retired" | "in-development";
  data_sources: string[];
  notes: string;
}

// Output of the LLM parser step
export interface ParsedMission {
  payload_mass_kg: number | null;
  orbit_type: "LEO" | "SSO" | "MEO" | "GTO" | "GEO" | "HEO" | "any" | null;
  target_altitude_km: number | null;
  budget_usd: number | null;
  schedule_months: number | null; // max acceptable lead time
  inclination_flexibility_required:
    | "fixed"
    | "limited"
    | "customer-defined"
    | "any"
    | null;
  raw_input: string;
  parse_confidence: "high" | "medium" | "low";
}

// One entry after filter/match, augmented with match metadata
export interface MatchedVehicle {
  entry: LaunchVehicleEntry;
  passes_mass: boolean;
  passes_orbit: boolean;
  passes_budget: boolean;
  passes_schedule: boolean;
  eliminated: boolean; // true if any hard constraint fails
  elimination_reason: string | null;
}
