import type { ParsedMission, LaunchVehicleEntry, MatchedVehicle } from "@/lib/types";

// ---------------------------------------------------------------------------
// Estimate launch cost given a mission's payload mass
// ---------------------------------------------------------------------------
function estimateCost(
  entry: LaunchVehicleEntry,
  payload_mass_kg: number | null
): number | null {
  const { model, base_usd, per_kg_usd, typical_total_usd } = entry.cost;

  if (model === "per-kg") {
    if (per_kg_usd !== null && payload_mass_kg !== null) {
      return per_kg_usd * payload_mass_kg;
    }
    return typical_total_usd;
  }

  if (model === "flat-per-launch") {
    return base_usd ?? typical_total_usd;
  }

  if (model === "base-plus-per-kg") {
    if (base_usd !== null && per_kg_usd !== null && payload_mass_kg !== null) {
      return base_usd + per_kg_usd * payload_mass_kg;
    }
    if (typical_total_usd !== null) return typical_total_usd;
    return base_usd;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pure filter function
// ---------------------------------------------------------------------------
export function filterCatalog(
  mission: ParsedMission,
  catalog: LaunchVehicleEntry[]
): MatchedVehicle[] {
  return catalog.map((entry) => {
    const reasons: string[] = [];

    // Hard-eliminate retired vehicles immediately
    if (entry.status === "retired") {
      return {
        entry,
        passes_mass: false,
        passes_orbit: false,
        passes_budget: false,
        passes_schedule: false,
        eliminated: true,
        elimination_reason: "Vehicle is retired and no longer operational.",
      };
    }

    // --- Mass check ---
    let passes_mass = true;
    if (
      mission.payload_mass_kg !== null &&
      entry.capacity.max_kg < mission.payload_mass_kg
    ) {
      passes_mass = false;
      reasons.push(
        `Payload ${mission.payload_mass_kg} kg exceeds vehicle max capacity ${entry.capacity.max_kg} kg.`
      );
    }

    // --- Orbit check ---
    let passes_orbit = true;
    if (mission.orbit_type !== null && mission.orbit_type !== "any") {
      const supported = entry.orbit_options.supported_orbit_types.map((o) =>
        o.toUpperCase()
      );
      if (!supported.includes(mission.orbit_type)) {
        passes_orbit = false;
        reasons.push(
          `Orbit type ${mission.orbit_type} not in supported types: ${entry.orbit_options.supported_orbit_types.join(", ")}.`
        );
      }
    }

    // --- Budget check ---
    let passes_budget = true;
    if (mission.budget_usd !== null) {
      const estimated = estimateCost(entry, mission.payload_mass_kg);
      if (estimated !== null && estimated > mission.budget_usd) {
        passes_budget = false;
        reasons.push(
          `Estimated cost $${estimated.toLocaleString()} exceeds budget $${mission.budget_usd.toLocaleString()}.`
        );
      }
    }

    // --- Schedule check ---
    let passes_schedule = true;
    if (mission.schedule_months !== null) {
      if (entry.integration.lead_time_months.min > mission.schedule_months) {
        passes_schedule = false;
        reasons.push(
          `Minimum lead time ${entry.integration.lead_time_months.min} months exceeds required schedule ${mission.schedule_months} months.`
        );
      }
    }

    const eliminated = !passes_mass || !passes_orbit || !passes_budget || !passes_schedule;

    return {
      entry,
      passes_mass,
      passes_orbit,
      passes_budget,
      passes_schedule,
      eliminated,
      elimination_reason: eliminated ? reasons.join(" ") : null,
    };
  });
}
