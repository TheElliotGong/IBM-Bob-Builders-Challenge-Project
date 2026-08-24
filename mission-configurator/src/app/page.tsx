"use client";

import { useState } from "react";
import type { ParsedMission, MatchedVehicle } from "@/lib/types";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Stars() {
  // Generate deterministic-looking star positions using a simple LCG
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  let seed = 42;
  for (let i = 0; i < 120; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const x = ((seed >>> 0) % 10000) / 100;
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const y = ((seed >>> 0) % 10000) / 100;
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const r = (((seed >>> 0) % 20) + 4) / 10;
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const o = (((seed >>> 0) % 60) + 40) / 100;
    stars.push({ x, y, r, o });
  }
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.o} />
      ))}
    </svg>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-48 shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-100 font-medium">
        {value ?? <span className="text-slate-500 italic">—</span>}
      </span>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const colors =
    level === "high"
      ? "bg-emerald-900/60 text-emerald-300 border-emerald-700"
      : level === "medium"
      ? "bg-amber-900/60 text-amber-300 border-amber-700"
      : "bg-rose-900/60 text-rose-300 border-rose-700";
  return (
    <span className={`px-2 py-0.5 text-xs rounded border font-semibold ${colors}`}>
      {level.toUpperCase()}
    </span>
  );
}

function MissionCard({ mission }: { mission: ParsedMission }) {
  const fmtUsd = (v: number | null) =>
    v !== null ? `$${v.toLocaleString()}` : null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-5 backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-slate-100 font-semibold text-base">Parsed Mission Requirements</h2>
        <ConfidenceBadge level={mission.parse_confidence} />
      </div>
      <div className="space-y-2">
        <FieldRow label="Payload mass" value={mission.payload_mass_kg != null ? `${mission.payload_mass_kg} kg` : null} />
        <FieldRow label="Orbit type" value={mission.orbit_type} />
        <FieldRow label="Target altitude" value={mission.target_altitude_km != null ? `${mission.target_altitude_km} km` : null} />
        <FieldRow label="Budget ceiling" value={fmtUsd(mission.budget_usd)} />
        <FieldRow label="Max lead time" value={mission.schedule_months != null ? `${mission.schedule_months} months` : null} />
        <FieldRow label="Inclination flexibility" value={mission.inclination_flexibility_required} />
      </div>
    </div>
  );
}

function VehicleCard({ match }: { match: MatchedVehicle }) {
  const { entry, eliminated, elimination_reason, passes_mass, passes_orbit, passes_budget, passes_schedule } = match;
  const borderColor = eliminated ? "border-rose-700/70" : "border-emerald-700/70";
  const headerColor = eliminated ? "text-rose-300" : "text-emerald-300";

  const Check = ({ ok }: { ok: boolean }) => (
    <span className={ok ? "text-emerald-400" : "text-rose-400"}>{ok ? "✓" : "✗"}</span>
  );

  return (
    <div className={`rounded-xl border ${borderColor} bg-slate-800/60 p-4 backdrop-blur`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className={`font-semibold text-sm ${headerColor}`}>{entry.vehicle}</p>
          <p className="text-slate-400 text-xs">{entry.provider} · {entry.type}</p>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-0.5 rounded border font-semibold ${
            eliminated
              ? "bg-rose-900/50 text-rose-300 border-rose-700"
              : "bg-emerald-900/50 text-emerald-300 border-emerald-700"
          }`}
        >
          {eliminated ? "ELIMINATED" : "VIABLE"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs text-slate-400 mb-2">
        <span><Check ok={passes_mass} /> Mass</span>
        <span><Check ok={passes_orbit} /> Orbit</span>
        <span><Check ok={passes_budget} /> Budget</span>
        <span><Check ok={passes_schedule} /> Schedule</span>
      </div>

      <div className="text-xs text-slate-500 space-y-0.5">
        <span>Max capacity: {entry.capacity.max_kg} kg</span>
        {" · "}
        <span>Lead time: {entry.integration.lead_time_months.min}–{entry.integration.lead_time_months.max} mo</span>
        {" · "}
        <span>Orbits: {entry.orbit_options.supported_orbit_types.join(", ")}</span>
      </div>

      {eliminated && elimination_reason && (
        <p className="mt-2 text-xs text-rose-400/90 border-t border-rose-900/40 pt-2">
          {elimination_reason}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PLACEHOLDER = `Example: "We have a 45 kg Earth observation satellite targeting a 550 km SSO orbit. Our total launch budget is $2.5 million and we need to launch within 12 months. We need a fixed SSO slot — inclination flexibility is not required."`;

export default function Home() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mission, setMission] = useState<ParsedMission | null>(null);
  const [matches, setMatches] = useState<MatchedVehicle[] | null>(null);

  async function handleAnalyze() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setMission(null);
    setMatches(null);

    try {
      // Step 1 — parse
      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!parseRes.ok) throw new Error(`Parse failed: ${parseRes.statusText}`);
      const parsedMission: ParsedMission = await parseRes.json();
      setMission(parsedMission);

      // Step 2 — filter
      const filterRes = await fetch("/api/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: parsedMission }),
      });
      if (!filterRes.ok) throw new Error(`Filter failed: ${filterRes.statusText}`);
      const { matches: vehicleMatches } = await filterRes.json();
      setMatches(vehicleMatches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const viableCount = matches?.filter((m) => !m.eliminated).length ?? 0;
  const eliminatedCount = matches?.filter((m) => m.eliminated).length ?? 0;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <Stars />

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-12 space-y-10">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-xs font-semibold tracking-widest text-sky-400 uppercase">
            IBM Builders Challenge · Day 2
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">
            AI Launch Vehicle Selector
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
            Describe your mission in plain English. The AI pipeline will parse
            your requirements and match them against the rideshare &amp; dedicated
            launch catalog.
          </p>
        </header>

        {/* Input */}
        <section className="space-y-3">
          <label
            htmlFor="mission-desc"
            className="block text-sm font-medium text-slate-300"
          >
            Mission Description
          </label>
          <textarea
            id="mission-desc"
            rows={5}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none backdrop-blur"
            placeholder={PLACEHOLDER}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !description.trim()}
            className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            {loading ? "Analyzing…" : "Analyze Mission"}
          </button>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-rose-700 bg-rose-900/30 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Results */}
        {mission && (
          <section className="space-y-6">
            <MissionCard mission={mission} />

            {matches && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-slate-100 font-semibold text-base">Launch Vehicle Matches</h2>
                  <span className="text-xs text-emerald-400 font-medium">{viableCount} viable</span>
                  <span className="text-xs text-rose-400 font-medium">{eliminatedCount} eliminated</span>
                </div>

                {/* Viable first, then eliminated */}
                {[...matches]
                  .sort((a, b) => (a.eliminated ? 1 : 0) - (b.eliminated ? 1 : 0))
                  .map((m) => (
                    <VehicleCard key={m.entry.id} match={m} />
                  ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
