import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Security headers applied to every response.
// ---------------------------------------------------------------------------
const securityHeaders = [
  // Prevent the page from being embedded in iframes on foreign origins
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  // Stop browsers from MIME-sniffing the declared content-type
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Only send the origin as Referer for cross-origin navigations
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Disable browser features we never use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Enforce HTTPS for 1 year once deployed (Vercel always serves HTTPS)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Content Security Policy
  // - default-src 'self'          → baseline: only own origin
  // - script-src 'self' 'unsafe-inline' → Next.js needs inline scripts for hydration
  // - style-src 'self' 'unsafe-inline' https://fonts.googleapis.com → Tailwind + Google Fonts
  // - font-src 'self' https://fonts.gstatic.com → Google Fonts CDN
  // - img-src 'self' data:         → data: URIs used for jsPDF-generated images
  // - connect-src 'self'           → API calls only to own origin
  // - object-src 'none'            → block Flash / plugins
  // - base-uri 'self'              → prevent base-tag injection
  // - frame-ancestors 'none'       → belt-and-suspenders on iframe embedding
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
