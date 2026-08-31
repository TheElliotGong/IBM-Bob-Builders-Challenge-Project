import { NextRequest, NextResponse } from "next/server";
import { improveMissionDescription } from "@/lib/improver";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_MISSING_ITEMS = 20;
const MAX_BODY_BYTES = 8_192;

export async function POST(req: NextRequest) {
  // Improve calls Gemini — stricter cap
  const limited = checkRateLimit(req, { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const body = await req.json();
    const description: unknown = body?.description;
    const missing: unknown = body?.missing ?? [];
    const model: string = typeof body?.model === "string" ? body.model : "gemini-3.5-flash-lite";

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Missing required field: description (string)" },
        { status: 400 }
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    if (!Array.isArray(missing)) {
      return NextResponse.json(
        { error: "Optional field missing must be an array of strings" },
        { status: 400 }
      );
    }

    const missingStrings = (missing as unknown[])
      .filter((x): x is string => typeof x === "string")
      .slice(0, MAX_MISSING_ITEMS);

    const result = await improveMissionDescription(description, missingStrings, model);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/improve]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
