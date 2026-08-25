"use client";

import { useState, useRef, useEffect } from "react";
import type { ExportPayload } from "@/lib/exporters";

// Format groups for the dropdown menu
const FORMAT_GROUPS: {
  label: string;
  formats: { id: string; label: string; ext: string; description: string }[];
}[] = [
  {
    label: "Document",
    formats: [
      { id: "pdf",  label: "PDF",        ext: ".pdf",  description: "Printable report" },
      { id: "docx", label: "Word (DOCX)", ext: ".docx", description: "Editable document" },
      { id: "md",   label: "Markdown",   ext: ".md",   description: "Plain-text formatted" },
      { id: "txt",  label: "Plain Text", ext: ".txt",  description: "Simple text report" },
    ],
  },
  {
    label: "Spreadsheet / Data",
    formats: [
      { id: "csv",  label: "CSV",  ext: ".csv",  description: "Import into Excel / Sheets" },
      { id: "json", label: "JSON", ext: ".json", description: "Structured raw data" },
    ],
  },
];

interface DownloadMenuProps {
  payload: ExportPayload;
}

export default function DownloadMenu({ payload }: DownloadMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function handleDownload(id: string) {
    setBusy(id);
    setOpen(false);
    try {
      const {
        downloadTxt,
        downloadMarkdown,
        downloadJson,
        downloadCsv,
        downloadPdf,
        downloadDocx,
      } = await import("@/lib/exporters");

      switch (id) {
        case "txt":  downloadTxt(payload); break;
        case "md":   downloadMarkdown(payload); break;
        case "json": downloadJson(payload); break;
        case "csv":  downloadCsv(payload); break;
        case "pdf":  await downloadPdf(payload); break;
        case "docx": await downloadDocx(payload); break;
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy !== null}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 hover:border-slate-500 text-sm font-medium text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {busy ? (
          <>
            <SpinnerIcon />
            Exporting…
          </>
        ) : (
          <>
            <DownloadIcon />
            Download Report
            <ChevronIcon open={open} />
          </>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-64 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl z-50 overflow-hidden"
        >
          {FORMAT_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </p>
              {group.formats.map((fmt) => (
                <button
                  key={fmt.id}
                  role="option"
                  onClick={() => handleDownload(fmt.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs font-mono font-bold text-sky-400 bg-slate-800 rounded px-1 py-0.5 text-center">
                      {fmt.ext}
                    </span>
                    <span className="text-slate-200">{fmt.label}</span>
                  </span>
                  <span className="text-slate-500 text-xs">{fmt.description}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (zero dependency)
// ---------------------------------------------------------------------------

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 2v8M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12h12" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}
