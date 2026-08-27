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
  website_url?: string;
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

// User-adjustable priority weights (0–1 each; need not sum to 1 — normalised internally)
export interface PriorityWeights {
  cost: number;          // favour lower estimated launch cost
  schedule: number;      // favour shorter integration lead time
  orbit_precision: number; // favour customer-defined inclination flexibility
}

// A viable vehicle annotated with its rank score and scoring breakdown
export interface RankedVehicle extends MatchedVehicle {
  score: number;           // 0–100 composite score (higher = better fit)
  score_breakdown: {
    cost_score: number;        // 0–100 normalised cost score
    schedule_score: number;    // 0–100 normalised schedule score
    orbit_score: number;       // 0–100 normalised orbit precision score
  };
  estimated_cost_usd: number | null;
  rank: number;              // 1-based rank among viable vehicles
}

// Full response from the /api/rank endpoint
export interface RankResponse {
  ranked: RankedVehicle[];
  eliminated: MatchedVehicle[];
}

// Response from the /api/explain endpoint
export interface ExplainResponse {
  explanation: string;   // plain-language rationale markdown
  fallback: boolean;     // true if Gemini was unavailable and a template was used
}

// A clarifying question for one missing field
export interface ClarifyingQuestion {
  field: string;   // key matching REQUIRED_FIELDS[].key
  question: string; // human-readable question to ask the user
  placeholder: string; // example input value
}

// Response from the /api/improve endpoint
export interface ImproveResponse {
  missing_fields: string[];        // names matching REQUIRED_FIELDS[].key
  clarifying_questions: ClarifyingQuestion[]; // one per missing field
  suggested_rewrite: string | null; // null when fallback (no LLM available)
  fallback: boolean;
  error?: string;                  // set when fallback was triggered by a real error
}

// A saved analysis session (persisted to localStorage)
export interface SessionRecord {
  id: string;                   // UUID
  createdAt: string;            // ISO timestamp
  description: string;          // raw user input
  weights: PriorityWeights;
  mission: ParsedMission;
  ranked: RankedVehicle[];
  eliminated: MatchedVehicle[];
  explanation: ExplainResponse | null;
}
