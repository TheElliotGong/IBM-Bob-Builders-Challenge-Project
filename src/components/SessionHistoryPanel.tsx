"use client";

import { useRef, useEffect } from "react";
import type { SessionRecord } from "@/lib/types";

const STORAGE_KEY = "launch-selector-sessions";
const MAX_SESSIONS = 50;

// ---------------------------------------------------------------------------
// Storage helpers (exported so page.tsx can use them)
// ---------------------------------------------------------------------------

export function loadSessions(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(record: SessionRecord): void {
  const existing = loadSessions();
  // Prepend newest first, cap at MAX_SESSIONS
  const updated = [record, ...existing.filter((s) => s.id !== record.id)].slice(
    0,
    MAX_SESSIONS
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteSession(id: string): SessionRecord[] {
  const updated = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearAllSessions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

interface SessionHistoryPanelProps {
  sessions: SessionRecord[];
  onRestore: (session: SessionRecord) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export default function SessionHistoryPanel({
  sessions,
  onRestore,
  onDelete,
  onClearAll,
}: SessionHistoryPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top whenever a new session is prepended
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [sessions.length]);

  if (sessions.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Session History
          <span className="ml-2 text-slate-600 font-normal normal-case tracking-normal">
            ({sessions.length})
          </span>
        </p>
        <button
          onClick={onClearAll}
          className="text-xs text-slate-600 hover:text-rose-400 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Horizontal scroll strip */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onRestore={onRestore}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Individual session card
// ---------------------------------------------------------------------------

function SessionCard({
  session,
  onRestore,
  onDelete,
}: {
  session: SessionRecord;
  onRestore: (s: SessionRecord) => void;
  onDelete: (id: string) => void;
}) {
  const topVehicle = session.ranked[0]?.entry;
  const date = new Date(session.createdAt);
  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const orbitLabel = session.mission.orbit_type ?? "—";
  const massLabel =
    session.mission.payload_mass_kg != null
      ? `${session.mission.payload_mass_kg} kg`
      : "—";
  const viableCount = session.ranked.length;

  return (
    <div className="snap-start shrink-0 w-52 rounded-xl border border-slate-700 bg-slate-800/70 backdrop-blur flex flex-col overflow-hidden">
      {/* Colour accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-sky-600 to-indigo-600" />

      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Timestamp */}
        <p className="text-[10px] text-slate-500">
          {dateStr} · {timeStr}
        </p>

        {/* Top match */}
        <div className="min-h-[2.5rem]">
          {topVehicle ? (
            <>
              <p className="text-xs font-semibold text-sky-300 leading-tight truncate">
                {topVehicle.vehicle}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{topVehicle.provider}</p>
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">No viable options</p>
          )}
        </div>

        {/* Key stats */}
        <div className="flex gap-1 flex-wrap">
          <StatChip label={orbitLabel} />
          <StatChip label={massLabel} />
          <StatChip label={`${viableCount} viable`} />
        </div>

        {/* Truncated prompt */}
        <p className="text-[10px] text-slate-600 leading-snug line-clamp-2 flex-1">
          {session.description}
        </p>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-700 flex">
        <button
          onClick={() => onRestore(session)}
          className="flex-1 py-1.5 text-xs text-sky-400 hover:bg-slate-700 transition-colors font-medium"
        >
          Restore
        </button>
        <div className="w-px bg-slate-700" />
        <button
          onClick={() => onDelete(session.id)}
          className="px-3 py-1.5 text-xs text-slate-500 hover:text-rose-400 hover:bg-slate-700 transition-colors"
          aria-label="Delete session"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function StatChip({ label }: { label: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400 font-medium">
      {label}
    </span>
  );
}
