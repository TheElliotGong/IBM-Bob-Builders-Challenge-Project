"use client";

import {
  useUISettings,
  SUPPORTED_LANGUAGES,
  GEMINI_MODELS,
  type Theme,
  type Density,
  type GeminiModel,
} from "@/lib/uiSettings";

// ---------------------------------------------------------------------------
// SettingsSidebar — always-visible settings panel pinned to the right
// ---------------------------------------------------------------------------

export default function SettingsSidebar() {
  const { settings, setSetting } = useUISettings();

  return (
    <aside
      aria-label="Settings"
      className="w-64 shrink-0 space-y-6"
    >
      <div className="sticky top-8 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Settings</h2>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-6">

          {/* Theme */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Appearance
            </legend>
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(["system", "dark", "light"] as Theme[]).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={settings.theme === t}
                  onClick={() => setSetting("theme", t)}
                  className={`
                    py-1.5 rounded-lg text-xs font-medium border transition-colors
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
            <div className="space-y-1 pt-1">
              {(["compact", "default", "spacious"] as Density[]).map((d) => (
                <label
                  key={d}
                  className={`
                    flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer border transition-colors
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
                  <p className="text-xs font-medium capitalize">{d}</p>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Language */}
          <div className="space-y-1.5">
            <label
              htmlFor="ui-language-sidebar"
              className="block text-xs font-semibold text-slate-400 uppercase tracking-wide"
            >
              Language
            </label>
            <select
              id="ui-language-sidebar"
              value={settings.language}
              onChange={(e) => setSetting("language", e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.tag} value={l.tag}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* AI Model */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              AI Model
            </legend>
            <div className="space-y-1 pt-1">
              {GEMINI_MODELS.map((m) => (
                <label
                  key={m.id}
                  className={`
                    flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer border transition-colors
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
            <p className="text-[10px] text-slate-600 pt-0.5">Settings are saved automatically.</p>
          </fieldset>

        </div>
      </div>
    </aside>
  );
}
