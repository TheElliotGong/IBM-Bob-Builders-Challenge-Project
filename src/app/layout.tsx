import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UISettingsProvider } from "@/lib/uiSettings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Satellite Launch Vehicle / Rideshare Configurator",
  description:
    "AI-powered mission planning configurator — match your satellite mission requirements to the best rideshare or dedicated launch option.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <UISettingsProvider>{children}</UISettingsProvider>
      </body>
    </html>
  );
}
