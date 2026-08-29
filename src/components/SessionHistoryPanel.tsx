"use client";

import { useRef, useEffect } from "react";
import type { SessionRecord } from "@/lib/types";
import { useUISettings } from "@/lib/uiSettings";

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
  const { settings } = useUISettings();
  const locale = settings.language;

  // Scroll to top whenever a new session is prepended
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [sessions.length]);

  if (sessions.length === 0) return null;

  return (
    <section aria-label="Session History" className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs lg:text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Session History
          <span className="ml-2 text-slate-600 font-normal normal-case tracking-normal" aria-label={`(${sessions.length} sessions)`}>
            ({sessions.length})
          </span>
        </h2>
        <button
          onClick={onClearAll}
          aria-label="Clear all session history"
          className="text-xs lg:text-sm text-slate-600 hover:text-rose-400 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-2 rounded"
        >
          Clear all
        </button>
      </div>

      {/* Horizontal scroll strip */}
      <div
        ref={scrollRef}
        role="list"
        aria-label="Past sessions"
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onRestore={onRestore}
            onDelete={onDelete}
            locale={locale}
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
  locale,
}: {
  session: SessionRecord;
  onRestore: (s: SessionRecord) => void;
  onDelete: (id: string) => void;
  locale: string;
}) {
  const topVehicle = session.ranked[0]?.entry;
  const date = new Date(session.createdAt);
  const dateStr = date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const orbitLabel = session.mission.orbit_type ?? "—";
  const massLabel =
    session.mission.payload_mass_kg != null
      ? `${session.mission.payload_mass_kg} kg`
      : "—";
  const viableCount = session.ranked.length;

  return (
    <div role="listitem" className="snap-start shrink-0 w-52 lg:w-60 rounded-xl border border-slate-700 bg-slate-800/70 backdrop-blur flex flex-col overflow-hidden">
      {/* Colour accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-sky-600 to-indigo-600" aria-hidden="true" />

      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Timestamp */}
        <p className="text-[10px] lg:text-xs text-slate-500">
          {dateStr} · {timeStr}
        </p>

        {/* Top match */}
        <div className="min-h-[2.5rem]">
          {topVehicle ? (
            <>
              <p className="text-xs lg:text-sm font-semibold text-sky-300 leading-tight truncate">
                {topVehicle.vehicle}
              </p>
              <p className="text-[10px] lg:text-xs text-slate-500 truncate">{topVehicle.provider}</p>
            </>
          ) : (
            <p className="text-xs lg:text-sm text-slate-500 italic">No viable options</p>
          )}
        </div>

        {/* Key stats */}
        <div className="flex gap-1 flex-wrap">
          <StatChip label={orbitLabel} />
          <StatChip label={massLabel} />
          <StatChip label={`${viableCount} viable`} />
        </div>

        {/* Truncated prompt */}
        <p className="text-[10px] lg:text-xs text-slate-600 leading-snug line-clamp-2 flex-1">
          {session.description}
        </p>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-700 flex">
        <button
          onClick={() => onRestore(session)}
          aria-label={`Restore session from ${dateStr} — ${topVehicle?.vehicle ?? "no viable options"}`}
          className="flex-1 py-1.5 lg:py-2 text-xs lg:text-sm text-sky-400 hover:bg-slate-700 transition-colors font-medium focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-[-2px]"
        >
          Restore
        </button>
        <div className="w-px bg-slate-700" aria-hidden="true" />
        <button
          onClick={() => onDelete(session.id)}
          aria-label={`Delete session from ${dateStr}`}
          className="px-3 py-1.5 lg:py-2 text-xs lg:text-sm text-slate-500 hover:text-rose-400 hover:bg-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-[-2px]"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}

function StatChip({ label }: { label: string }) {
  return (
    <span className="text-[10px] lg:text-xs px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400 font-medium">
      {label}
    </span>
  );
}
