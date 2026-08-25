"use client";

import { useState, useCallback } from "react";
import type {
  ParsedMission,
  RankedVehicle,
  MatchedVehicle,
  PriorityWeights,
  ExplainResponse,
  ImproveResponse,
  SessionRecord,
} from "@/lib/types";
import DownloadMenu from "@/components/DownloadMenu";
import SessionHistoryPanel, {
  loadSessions,
  saveSession,
  deleteSession,
  clearAllSessions,
} from "@/components/SessionHistoryPanel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUsd(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Required fields — single source of truth used by PromptFieldsHint,
// ImprovePanel (Tier 2) and Tier-1 missing-field detection.
// ---------------------------------------------------------------------------

export const REQUIRED_FIELDS: {
  name: string;
  key: keyof Omit<ParsedMission, "raw_input" | "parse_confidence">;
  hint: string;
  example: string;
}[] = [
  { name: "Payload mass",        key: "payload_mass_kg",                    hint: "Mass of your satellite or payload",          example: "45 kg" },
  { name: "Orbit type",          key: "orbit_type",                         hint: "Target orbital regime",                      example: "LEO, SSO, GEO, GTO, MEO, HEO" },
  { name: "Target altitude",     key: "target_altitude_km",                 hint: "Desired orbital altitude",                   example: "550 km" },
  { name: "Budget ceiling",      key: "budget_usd",                         hint: "Maximum launch budget",                      example: "$2.5M" },
  { name: "Max lead time",       key: "schedule_months",                    hint: "Months from contract to launch",             example: "12 months" },
  { name: "Inclination control", key: "inclination_flexibility_required",   hint: "How precise your orbital plane must be",     example: "fixed, flexible, customer-defined" },
];

/** Return the REQUIRED_FIELDS entries whose corresponding ParsedMission value is null. */
function getMissingFields(
  mission: ParsedMission
): typeof REQUIRED_FIELDS {
  return REQUIRED_FIELDS.filter((f) => mission[f.key] === null);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Stars() {
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
      <dt className="w-48 shrink-0 text-slate-400">{label}</dt>
      <dd className="text-slate-100 font-medium m-0">
        {value ?? <span className="text-slate-500 italic" aria-label="not specified">—</span>}
      </dd>
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
      {level.toUpperCase()} CONFIDENCE
    </span>
  );
}

function MissionCard({
  mission,
  onImproveClick,
}: {
  mission: ParsedMission;
  onImproveClick?: () => void;
}) {
  const missingFields = getMissingFields(mission);
  const showNudge =
    mission.parse_confidence !== "high" && missingFields.length > 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-5 backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-slate-100 font-semibold text-base">Parsed Mission Requirements</h2>
        <ConfidenceBadge level={mission.parse_confidence} />
      </div>
      <dl className="space-y-2">
        <FieldRow
          label="Payload mass"
          value={mission.payload_mass_kg != null ? `${mission.payload_mass_kg} kg` : null}
        />
        <FieldRow label="Orbit type" value={mission.orbit_type} />
        <FieldRow
          label="Target altitude"
          value={mission.target_altitude_km != null ? `${mission.target_altitude_km} km` : null}
        />
        <FieldRow
          label="Budget ceiling"
          value={mission.budget_usd != null ? fmtUsd(mission.budget_usd) : null}
        />
        <FieldRow
          label="Max lead time"
          value={mission.schedule_months != null ? `${mission.schedule_months} months` : null}
        />
        <FieldRow
          label="Inclination flexibility"
          value={mission.inclination_flexibility_required}
        />
      </dl>

      {/* Tier-1 nudge: missing fields visible without any extra network call */}
      {showNudge && (
        <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2.5 text-xs text-amber-300 space-y-1.5">
          <p className="font-semibold">
            Fields not found in your description:
          </p>
          <p className="text-amber-400/80 leading-relaxed">
            {missingFields.map((f) => f.name).join(" · ")}
          </p>
          {onImproveClick && (
            <button
              onClick={onImproveClick}
              className="mt-1 text-amber-300 underline underline-offset-2 hover:text-amber-200 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-2 rounded"
            >
              Improve my description ↑
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Score bar for the breakdown panel
function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-slate-400">
        <span id={`score-label-${label.replace(/\s+/g, "-").toLowerCase()}`}>{label}</span>
        <span aria-hidden="true">{score}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby={`score-label-${label.replace(/\s+/g, "-").toLowerCase()}`}
        aria-valuetext={`${score} out of 100`}
        className="h-1.5 w-full rounded-full bg-slate-700"
      >
        <div
          className={`h-1.5 rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function RankedVehicleCard({ match, isTop }: { match: RankedVehicle; isTop: boolean }) {
  const [open, setOpen] = useState(false);
  const { entry, score, score_breakdown, estimated_cost_usd, rank } = match;

  return (
    <div
      className={`rounded-xl border bg-slate-800/60 p-4 backdrop-blur transition-colors ${
        isTop ? "border-sky-600/80" : "border-emerald-700/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* Rank badge */}
          <span
            className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
              isTop
                ? "bg-sky-600 text-white"
                : "bg-slate-700 text-slate-300"
            }`}
          >
            #{rank}
          </span>
          <div>
            <p className={`font-semibold text-sm ${isTop ? "text-sky-200" : "text-emerald-200"}`}>
              {entry.vehicle}
            </p>
            <p className="text-slate-400 text-xs">{entry.provider} · {entry.type}</p>
          </div>
        </div>

        {/* Overall score chip */}
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-400">Score</p>
          <p className={`text-lg font-bold ${isTop ? "text-sky-300" : "text-emerald-300"}`}>
            {score}
          </p>
        </div>
      </div>

      {/* Key stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-slate-700/50 px-2 py-1.5 text-center">
          <p className="text-slate-400 mb-0.5">Est. Cost</p>
          <p className="text-slate-100 font-medium">{fmtUsd(estimated_cost_usd)}</p>
        </div>
        <div className="rounded-lg bg-slate-700/50 px-2 py-1.5 text-center">
          <p className="text-slate-400 mb-0.5">Lead Time</p>
          <p className="text-slate-100 font-medium">
            {entry.integration.lead_time_months.min}–{entry.integration.lead_time_months.max} mo
          </p>
        </div>
        <div className="rounded-lg bg-slate-700/50 px-2 py-1.5 text-center">
          <p className="text-slate-400 mb-0.5">Inclination</p>
          <p className="text-slate-100 font-medium capitalize">
            {entry.orbit_options.inclination_flexibility}
          </p>
        </div>
      </div>

      {/* Score breakdown toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`breakdown-${rank}`}
        className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-2 rounded"
      >
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>{" "}
        {open ? "Hide breakdown" : "Score breakdown"}
      </button>
      <div id={`breakdown-${rank}`} hidden={!open}>
        {open && (
          <div className="mt-2 space-y-2">
            <ScoreBar label="Cost efficiency" score={score_breakdown.cost_score} />
            <ScoreBar label="Schedule" score={score_breakdown.schedule_score} />
            <ScoreBar label="Orbit precision" score={score_breakdown.orbit_score} />
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "text-emerald-400" : "text-rose-400"} aria-hidden="true">
      {ok ? "✓" : "✗"}
    </span>
  );
}

function EliminatedCard({ match }: { match: MatchedVehicle }) {
  return (
    <div className="rounded-xl border border-rose-700/40 bg-slate-800/40 p-4 backdrop-blur opacity-70">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-sm text-rose-300">{match.entry.vehicle}</p>
          <p className="text-slate-500 text-xs">{match.entry.provider} · {match.entry.type}</p>
        </div>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded border font-semibold bg-rose-900/50 text-rose-300 border-rose-700">
          ELIMINATED
        </span>
      </div>
      <ul className="grid grid-cols-4 gap-1 text-xs text-slate-500 mb-2 list-none p-0">
        <li>
          <CheckIcon ok={match.passes_mass} />
          <span className="sr-only">{match.passes_mass ? "Pass" : "Fail"}:</span>
          {" "}Mass
        </li>
        <li>
          <CheckIcon ok={match.passes_orbit} />
          <span className="sr-only">{match.passes_orbit ? "Pass" : "Fail"}:</span>
          {" "}Orbit
        </li>
        <li>
          <CheckIcon ok={match.passes_budget} />
          <span className="sr-only">{match.passes_budget ? "Pass" : "Fail"}:</span>
          {" "}Budget
        </li>
        <li>
          <CheckIcon ok={match.passes_schedule} />
          <span className="sr-only">{match.passes_schedule ? "Pass" : "Fail"}:</span>
          {" "}Schedule
        </li>
      </ul>
      {match.elimination_reason && (
        <p className="text-xs text-rose-400/80 border-t border-rose-900/30 pt-2">
          {match.elimination_reason}
        </p>
      )}
    </div>
  );
}

function ExplanationPanel({ data }: { data: ExplainResponse }) {
  return (
    <div className="rounded-xl border border-sky-800/60 bg-slate-800/70 p-5 backdrop-blur space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-100 font-semibold text-base">AI Recommendation</h2>
        {data.fallback && (
          <span className="text-xs px-2 py-0.5 rounded border bg-amber-900/40 text-amber-300 border-amber-700">
            TEMPLATE
          </span>
        )}
      </div>
      <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
        {data.explanation}
      </div>
    </div>
  );
}

// Priority weight slider
function WeightSlider({
  label,
  plainLabel,
  description,
  value,
  onChange,
}: {
  label: React.ReactNode;
  plainLabel: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = `weight-${plainLabel.toLowerCase().replace(/\s+/g, "-")}`;
  const descId = `${id}-desc`;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <label htmlFor={id} className="text-slate-300 font-medium">{label}</label>
        <span className="text-slate-400" aria-hidden="true">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={5}
        step={1}
        value={value}
        aria-valuetext={`${value} out of 5`}
        aria-describedby={descId}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-500"
      />
      <p id={descId} className="text-xs text-slate-500">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromptFieldsHint
// ---------------------------------------------------------------------------

function PromptFieldsHint() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        Fields extracted from your description
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {REQUIRED_FIELDS.map((f) => (
          <div key={f.name} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-sky-500/70" />
            <div>
              <span className="text-slate-200 font-medium">{f.name}</span>
              <span className="text-slate-500"> — {f.hint}</span>
              <span className="block text-slate-600 italic">e.g. {f.example}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImprovePanel — Tier-2 "Improve my description" button + result display
// ---------------------------------------------------------------------------

function ImprovePanel({
  description,
  onUseRewrite,
}: {
  description: string;
  onUseRewrite: (rewrite: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImproveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImprove() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setOpen(true);

    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          missing: REQUIRED_FIELDS.map((f) => f.key),
        }),
      });
      if (!res.ok) throw new Error(`Improve failed: ${res.statusText}`);
      const data: ImproveResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const panelId = "improve-panel";

  return (
    <div className="space-y-2">
      <button
        onClick={handleImprove}
        disabled={loading || !description.trim()}
        aria-expanded={open}
        aria-controls={panelId}
        className="px-4 py-2 rounded-lg border border-sky-600 bg-sky-900/30 hover:bg-sky-800/50 hover:border-sky-500 disabled:border-slate-700 disabled:bg-transparent disabled:text-slate-600 disabled:cursor-not-allowed text-sm font-medium text-sky-300 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-2"
      >
        {loading ? "Analyzing description…" : "Improve my description ✦"}
      </button>

      <div id={panelId} hidden={!open}>
        {open && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 space-y-3 text-xs">
            {error && (
              <p role="alert" className="text-rose-400">
                {error}
              </p>
            )}

            {result && (
              <>
                {/* Missing fields list — matches PromptFieldsHint visual language */}
                {result.missing_fields.length > 0 ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-400 uppercase tracking-wide">
                      Missing or ambiguous fields
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {result.missing_fields.map((key) => {
                        const field = REQUIRED_FIELDS.find((f) => f.key === key);
                        const label = field?.name ?? key;
                        return (
                          <div key={key} className="flex items-center gap-1.5">
                            <span className="shrink-0 w-2 h-2 rounded-full bg-amber-500/70" />
                            <span className="text-slate-200">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">All fields appear to be present.</p>
                )}

                {/* Suggested rewrite */}
                {result.suggested_rewrite && (
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-400 uppercase tracking-wide">
                      Suggested rewrite
                    </p>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {result.suggested_rewrite}
                    </p>
                    <button
                      onClick={() => onUseRewrite(result.suggested_rewrite!)}
                      className="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-2"
                    >
                      Use this
                    </button>
                  </div>
                )}

                {result.fallback && !result.suggested_rewrite && (
                  <p className="text-slate-500 italic">
                    *(AI rewrite unavailable — set GEMINI_API_KEY for a full suggested rewrite.)*
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PLACEHOLDER = `Example: "We have a 45 kg Earth observation satellite targeting a 550 km SSO orbit. Our total launch budget is $2.5M and we need to launch within 12 months."`;

const DEFAULT_WEIGHTS: PriorityWeights = { cost: 3, schedule: 3, orbit_precision: 3 };

export default function Home() {
  const [description, setDescription] = useState("");
  const [weights, setWeights] = useState<PriorityWeights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [mission, setMission] = useState<ParsedMission | null>(null);
  const [ranked, setRanked] = useState<RankedVehicle[] | null>(null);
  const [eliminated, setEliminated] = useState<MatchedVehicle[] | null>(null);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);

  // Session history — lazy init reads localStorage only on the client
  const [sessions, setSessions] = useState<SessionRecord[]>(() =>
    typeof window !== "undefined" ? loadSessions() : []
  );

  // Ref used to scroll/focus the textarea when "Improve my description ↑" is clicked
  // from inside MissionCard (Tier-1 nudge)
  function scrollToTextarea() {
    document.getElementById("mission-desc")?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("mission-desc")?.focus();
  }

  function setWeight(key: keyof PriorityWeights, value: number) {
    setWeights((w) => ({ ...w, [key]: value }));
  }

  // Restore a past session back into the UI
  const handleRestoreSession = useCallback((session: SessionRecord) => {
    setDescription(session.description);
    setWeights(session.weights);
    setMission(session.mission);
    setRanked(session.ranked);
    setEliminated(session.eliminated);
    setExplanation(session.explanation);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(deleteSession(id));
  }, []);

  const handleClearAll = useCallback(() => {
    clearAllSessions();
    setSessions([]);
  }, []);

  async function handleAnalyze() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setMission(null);
    setRanked(null);
    setEliminated(null);
    setExplanation(null);

    try {
      // Step 1 — parse
      setLoadingStep("Parsing mission requirements…");
      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!parseRes.ok) throw new Error(`Parse failed: ${parseRes.statusText}`);
      const parsedMission: ParsedMission = await parseRes.json();
      setMission(parsedMission);

      // Step 2 — rank (filter is embedded in the rank route)
      setLoadingStep("Filtering and ranking launch options…");
      const rankRes = await fetch("/api/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: parsedMission, weights }),
      });
      if (!rankRes.ok) throw new Error(`Rank failed: ${rankRes.statusText}`);
      const { ranked: rankedVehicles, eliminated: eliminatedVehicles } = await rankRes.json();
      setRanked(rankedVehicles);
      setEliminated(eliminatedVehicles);

      // Step 3 — explain
      setLoadingStep("Generating AI explanation…");
      const explainRes = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ranked: rankedVehicles, mission: parsedMission, weights }),
      });
      if (!explainRes.ok) throw new Error(`Explain failed: ${explainRes.statusText}`);
      const explainData: ExplainResponse = await explainRes.json();
      setExplanation(explainData);

      // Save session to localStorage
      const record: SessionRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        description,
        weights,
        mission: parsedMission,
        ranked: rankedVehicles,
        eliminated: eliminatedVehicles,
        explanation: explainData,
      };
      saveSession(record);
      setSessions(loadSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 px-4 py-2 rounded bg-sky-600 text-white text-sm font-semibold"
      >
        Skip to main content
      </a>
      <Stars />

      <main id="main-content" className="relative z-10 max-w-3xl mx-auto px-4 py-12 space-y-10">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-xs font-semibold tracking-widest text-sky-400 uppercase" aria-hidden="true">
            IBM Builders Challenge · Mission Planning
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">
            AI Launch Vehicle Selector
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
            Describe your mission in plain English. The AI pipeline will parse your requirements,
            filter the launch catalog, rank options by your priorities, and explain the trade-offs.
          </p>
        </header>

        {/* Input */}
        <section className="space-y-3">
          <label htmlFor="mission-desc" className="block text-sm font-medium text-slate-300">
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

          {/* Tier-2: Improve my description button + result panel */}
          <ImprovePanel
            description={description}
            onUseRewrite={(rewrite) => setDescription(rewrite)}
          />

          <PromptFieldsHint />

          {/* Priority weight sliders */}
          <fieldset className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-4">
            <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wide px-1">
              Mission Priorities
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <WeightSlider
                label={<><span aria-hidden="true">💰 </span>Cost</>}
                plainLabel="Cost"
                description="Favour lower launch cost"
                value={weights.cost}
                onChange={(v) => setWeight("cost", v)}
              />
              <WeightSlider
                label={<><span aria-hidden="true">⏱ </span>Schedule</>}
                plainLabel="Schedule"
                description="Favour shorter lead times"
                value={weights.schedule}
                onChange={(v) => setWeight("schedule", v)}
              />
              <WeightSlider
                label={<><span aria-hidden="true">🎯 </span>Orbit Precision</>}
                plainLabel="Orbit Precision"
                description="Favour custom inclination control"
                value={weights.orbit_precision}
                onChange={(v) => setWeight("orbit_precision", v)}
              />
            </div>
          </fieldset>

          <button
            onClick={handleAnalyze}
            disabled={loading || !description.trim()}
            className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            {loading ? loadingStep || "Analyzing…" : "Analyze Mission"}
          </button>
        </section>

        {/* Error */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-rose-700 bg-rose-900/30 px-4 py-3 text-sm text-rose-300"
          >
            <span className="sr-only">Error: </span>
            {error}
          </div>
        )}

        {/* Session History */}
        <SessionHistoryPanel
          sessions={sessions}
          onRestore={handleRestoreSession}
          onDelete={handleDeleteSession}
          onClearAll={handleClearAll}
        />

        {/* Results */}
        {mission && (
          <section aria-label="Analysis Results" className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Analysis Results
              </h2>
              <DownloadMenu
                payload={{
                  mission,
                  ranked: ranked ?? [],
                  eliminated: eliminated ?? [],
                  explanation,
                }}
              />
            </div>

            {/* Tier-1 nudge lives inside MissionCard; clicking "Improve ↑" scrolls to textarea */}
            <MissionCard mission={mission} onImproveClick={scrollToTextarea} />

            {/* AI Explanation */}
            {explanation && <ExplanationPanel data={explanation} />}

            {/* Ranked viable vehicles */}
            {ranked && ranked.length > 0 && (
              <section aria-label="Ranked Launch Options" className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-slate-100 font-semibold text-base">Ranked Launch Options</h3>
                  <span className="text-xs text-emerald-400 font-medium" aria-label={`${ranked.length} viable options`}>
                    {ranked.length} viable
                  </span>
                </div>
                {ranked.map((m) => (
                  <RankedVehicleCard key={m.entry.id} match={m} isTop={m.rank === 1} />
                ))}
              </section>
            )}

            {/* No viable options */}
            {ranked && ranked.length === 0 && (
              <div role="status" className="rounded-xl border border-amber-700/60 bg-amber-900/20 px-5 py-4 text-sm text-amber-300">
                No vehicles passed all constraints. Consider relaxing your budget, schedule, or orbit requirements.
              </div>
            )}

            {/* Eliminated vehicles (collapsible) */}
            {eliminated && eliminated.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors list-none focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-2 rounded">
                  <span aria-hidden="true">▶ </span>Show {eliminated.length} eliminated option{eliminated.length !== 1 ? "s" : ""}
                </summary>
                <div className="mt-3 space-y-3">
                  {eliminated.map((m) => (
                    <EliminatedCard key={m.entry.id} match={m} />
                  ))}
                </div>
              </details>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
