/**
 * In-memory sliding-window rate limiter for Next.js API routes.
 *
 * This is a simple per-IP counter that lives in the Edge/Node runtime's
 * module scope.  On Vercel, each serverless function instance has its own
 * memory, so the effective limit is `max` per `windowMs` per *instance*.
 * That is intentional — it prevents a single client from hammering one
 * instance.  For a global hard cap you would use Vercel KV or Redis; for
 * this app's threat model (protecting a paid Gemini API key from runaway
 * calls) in-process limiting is sufficient.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

/** Returns the caller's IP from a Next.js request, falling back to "unknown". */
function getIp(req: Request): string {
  // Vercel sets x-forwarded-for; fall back to cf-connecting-ip (Cloudflare)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return "unknown";
}

export interface RateLimitOptions {
  /** Sliding window length in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
  /** Maximum allowed requests per window per IP. Default: 20. */
  max?: number;
}

/**
 * Checks whether the given request is within the rate limit.
 *
 * @returns `null` if the request is allowed, or a 429 `Response` to return immediately.
 */
export function checkRateLimit(
  req: Request,
  options: RateLimitOptions = {}
): Response | null {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 20;
  const now = Date.now();
  const ip = getIp(req);

  // Purge any expired entries opportunistically (keeps the Map from growing unbounded)
  if (store.size > 10_000) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }

  let entry = store.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(ip, entry);
    return null;
  }

  entry.count += 1;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(
      JSON.stringify({ error: "Too many requests — please wait before retrying." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  return null;
}
