"use client";

import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-6 text-center">
        <p className="text-6xl font-bold text-slate-600 mb-4 font-mono">500</p>
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-slate-400 max-w-sm mb-2">
          An unexpected error occurred while rendering this page.
        </p>
        {error.digest && (
          <p className="text-slate-600 text-xs font-mono mb-6">
            ref: {error.digest}
          </p>
        )}
        {!error.digest && <div className="mb-6" />}
        <button
          onClick={retry}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
