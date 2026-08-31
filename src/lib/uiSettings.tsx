"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Theme = "dark" | "light" | "system";
export type Density = "compact" | "default" | "spacious";
export type GeminiModel =
  | "gemini-3.6-flash"
  | "gemini-3.5-flash"
  | "gemini-3.1-flash-lite";

export const GEMINI_MODELS: { id: GeminiModel; label: string }[] = [
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash Lite" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash Lite" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
];

export interface UISettings {
  theme: Theme;
  density: Density;
  language: string; // BCP-47 locale tag, e.g. "en-US"
  geminiModel: GeminiModel;
}

interface UISettingsContextValue {
  settings: UISettings;
  setSetting: <K extends keyof UISettings>(key: K, value: UISettings[K]) => void;
  /** Resolved to "dark" or "light" regardless of "system" choice */
  resolvedTheme: "dark" | "light";
}

// ---------------------------------------------------------------------------
// Defaults & storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = "launch-selector-ui-settings";

const DEFAULT_SETTINGS: UISettings = {
  theme: "system",
  density: "default",
  language: "en-US",
  geminiModel: "gemini-3.6-flash",
};

export const SUPPORTED_LANGUAGES: { tag: string; label: string }[] = [
  { tag: "en-US", label: "English (US)" },
  { tag: "en-GB", label: "English (UK)" },
  { tag: "de-DE", label: "Deutsch" },
  { tag: "fr-FR", label: "Français" },
  { tag: "ja-JP", label: "日本語" },
  { tag: "zh-CN", label: "中文 (简体)" },
  { tag: "es-ES", label: "Español" },
  { tag: "pt-BR", label: "Português (BR)" },
];

const KNOWN_GEMINI_MODELS = new Set<string>(GEMINI_MODELS.map((m) => m.id));

function loadSettings(): UISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    // A previously-saved model id can go stale (renamed/retired upstream) —
    // fall back to the default rather than persisting a call that 404s forever.
    if (!KNOWN_GEMINI_MODELS.has(merged.geminiModel)) {
      merged.geminiModel = DEFAULT_SETTINGS.geminiModel;
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: UISettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const UISettingsContext = createContext<UISettingsContextValue | null>(null);

export function UISettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UISettings>(DEFAULT_SETTINGS);
  const [systemDark, setSystemDark] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setSettings(loadSettings()); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Track system color scheme
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "dark" | "light" =
    settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;

  // Apply theme class to <html>
  useEffect(() => {
    const html = document.documentElement;
    if (resolvedTheme === "light") {
      html.classList.add("light-mode");
      html.classList.remove("dark-mode");
    } else {
      html.classList.add("dark-mode");
      html.classList.remove("light-mode");
    }
  }, [resolvedTheme]);

  // Apply density class to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("density-compact", "density-default", "density-spacious");
    html.classList.add(`density-${settings.density}`);
  }, [settings.density]);

  const setSetting = useCallback(
    <K extends keyof UISettings>(key: K, value: UISettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  return (
    <UISettingsContext.Provider value={{ settings, setSetting, resolvedTheme }}>
      {children}
    </UISettingsContext.Provider>
  );
}

export function useUISettings(): UISettingsContextValue {
  const ctx = useContext(UISettingsContext);
  if (!ctx) throw new Error("useUISettings must be used inside <UISettingsProvider>");
  return ctx;
}
