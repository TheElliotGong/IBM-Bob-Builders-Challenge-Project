"use client";

import { useEffect, useRef } from "react";
import {
  useUISettings,
  SUPPORTED_LANGUAGES,
  GEMINI_MODELS,
  type Theme,
  type Density,
  type GeminiModel,
} from "@/lib/uiSettings";

// ---------------------------------------------------------------------------
// SettingsPanel — slide-in drawer from the right
// ---------------------------------------------------------------------------

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, setSetting } = useUISettings();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus the close button when panel opens
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Trap focus inside the panel while open
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={`
          fixed top-0 right-0 z-50 h-full w-80 max-w-full
          bg-slate-900 border-l border-slate-700 shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close settings"
            className="text-slate-400 hover:text-slate-100 transition-colors rounded focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-2 p-1"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

          {/* Theme */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Appearance
            </legend>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(["system", "dark", "light"] as Theme[]).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={settings.theme === t}
                  onClick={() => setSetting("theme", t)}
                  className={`
                    py-2 rounded-lg text-xs font-medium border transition-colors
                    focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-2
                    ${settings.theme === t
                      ? "bg-sky-600 border-sky-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }
                  `}
                >
                  {t === "system" ? "System" : t === "dark" ? "🌙 Dark" : "☀️ Light"}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Density */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Density
            </legend>
            <div className="space-y-1.5 pt-1">
              {(["compact", "default", "spacious"] as Density[]).map((d) => (
                <label
                  key={d}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer border transition-colors
                    ${settings.density === d
                      ? "bg-sky-600/20 border-sky-600/60 text-sky-300"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="density"
                    value={d}
                    checked={settings.density === d}
                    onChange={() => setSetting("density", d)}
                    className="sr-only"
                  />
                  <DensityIcon density={d} active={settings.density === d} />
                  <div>
                    <p className="text-xs font-medium capitalize">{d}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {d === "compact"
                        ? "Tighter spacing, smaller text"
                        : d === "default"
                        ? "Balanced spacing and size"
                        : "More breathing room"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Language */}
          <div className="space-y-2">
            <label
              htmlFor="ui-language"
              className="block text-xs font-semibold text-slate-400 uppercase tracking-wide"
            >
              Language / Locale
            </label>
            <select
              id="ui-language"
              value={settings.language}
              onChange={(e) => setSetting("language", e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.tag} value={l.tag}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Affects date, time, and number formatting across the app.
            </p>
          </div>

          {/* AI Model */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              AI Model
            </legend>
            <div className="space-y-1.5 pt-1">
              {GEMINI_MODELS.map((m) => (
                <label
                  key={m.id}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer border transition-colors
                    ${settings.geminiModel === m.id
                      ? "bg-sky-600/20 border-sky-600/60 text-sky-300"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="geminiModel"
                    value={m.id}
                    checked={settings.geminiModel === m.id}
                    onChange={() => setSetting("geminiModel", m.id as GeminiModel)}
                    className="sr-only"
                  />
                  <span className="text-xs font-medium">{m.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Model used for parsing, explanation, and description improvement.
            </p>
          </fieldset>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 px-5 py-3">
          <p className="text-[11px] text-slate-600">Settings are saved automatically.</p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Small icon for each density option
// ---------------------------------------------------------------------------

function DensityIcon({ density, active }: { density: Density; active: boolean }) {
  const color = active ? "#38bdf8" : "#64748b";
  if (density === "compact") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
        <rect x="2" y="3" width="16" height="2" rx="1" fill={color} />
        <rect x="2" y="7" width="16" height="2" rx="1" fill={color} />
        <rect x="2" y="11" width="16" height="2" rx="1" fill={color} />
        <rect x="2" y="15" width="16" height="2" rx="1" fill={color} />
      </svg>
    );
  }
  if (density === "default") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
        <rect x="2" y="3" width="16" height="3" rx="1" fill={color} />
        <rect x="2" y="9" width="16" height="3" rx="1" fill={color} />
        <rect x="2" y="15" width="16" height="3" rx="1" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <rect x="2" y="2" width="16" height="4" rx="1" fill={color} />
      <rect x="2" y="10" width="16" height="4" rx="1" fill={color} />
    </svg>
  );
}
