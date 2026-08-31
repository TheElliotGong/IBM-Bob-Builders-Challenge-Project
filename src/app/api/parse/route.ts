import { NextRequest, NextResponse } from "next/server";
import { parseMissionDescription } from "@/lib/parser";
import { checkRateLimit } from "@/lib/rateLimit";

/** Maximum characters accepted for a mission description. */
const MAX_DESCRIPTION_LENGTH = 2_000;
/** Maximum raw body size in bytes before we reject the request. */
const MAX_BODY_BYTES = 8_192;

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, { windowMs: 60_000, max: 20 });
  if (limited) return limited;

  try {
    // Enforce a raw body size ceiling before parsing JSON
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const body = await req.json();
    const description: string = body?.description;
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

    const parsed = await parseMissionDescription(description, model);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/parse]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
