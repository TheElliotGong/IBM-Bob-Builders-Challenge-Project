import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 – Page Not Found | Launch Vehicle Configurator",
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-6 text-center">
      <p className="text-6xl font-bold text-slate-600 mb-4 font-mono">404</p>
      <h1 className="text-2xl font-semibold mb-2">Page Not Found</h1>
      <p className="text-slate-400 max-w-sm mb-8">
        The URL you requested doesn&apos;t exist or has been moved. Double-check
        the address, or head back to the configurator.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
      >
        Back to Configurator
      </Link>
    </main>
  );
}
